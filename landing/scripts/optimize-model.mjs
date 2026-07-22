import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup, prune, weld, weldPrimitive, simplifyPrimitive, textureCompress, meshopt,
} from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { writeFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Source CAD export (152 MB, ~1.65 M tris). Produces two web variants:
//   public/models/module-v2.glb        — desktop (~300 k tris, 1024px textures, ≤8 MB)
//   public/models/module-mobile-v2.glb — phones  (~120 k tris, 512px textures, ≤3 MB)
// The runtime picks the mobile file on coarse-pointer / low-tier devices.
// NOTE: /models/* ships with a 1-year immutable cache header, so output names
// are versioned (…-v2). Never overwrite a previously shipped filename — bump
// the suffix instead and leave the old files in place.
const SRC = '/Users/reza/Workspace/embion/path_planner_module.glb';

// Per-mesh budgets: { tris, errorStart, errorCap }. `error` starts at
// errorStart and doubles ONLY when a pass stalls, capped at errorCap — it
// never grows on a successful pass. Meshes absent from the map (and meshes
// already within budget×1.15) ship full source geometry with their authored
// split normals and index buffers untouched.
//
// The Jetson dev-kit gets a dedicated close-up chapter (fan + heatsink), and
// the lidar puck / IMU are hero-visible sensor parts — all three keep large
// budgets. Small chassis/shell parts are cheap enough to ship as-is on
// desktop.
const VARIANTS = [
  {
    out: process.argv[2] ?? './public/models/module-v2.glb',
    anchorsOut: process.argv[3] ?? './src/data/anchors.json',
    tex: 1024,
    budgets: {
      'jetson-orin-nano-super-dev-kit': { tris: 100_000, errorStart: 1e-3, errorCap: 0.01 },
      'lidar-ld19': { tris: 90_000, errorStart: 5e-4, errorCap: 0.003 },
      'IMU': { tris: 30_000, errorStart: 5e-4, errorCap: 0.005 },
    },
    limits: { minTris: 250_000, maxTris: 400_000, maxBytes: 8_000_000 },
  },
  {
    out: './public/models/module-mobile-v2.glb',
    anchorsOut: null, // desktop anchors are authoritative; sizes match
    tex: 512,
    budgets: {
      'jetson-orin-nano-super-dev-kit': { tris: 30_000, errorStart: 1e-3, errorCap: 0.01 },
      'lidar-ld19': { tris: 28_000, errorStart: 5e-4, errorCap: 0.004 },
      'IMU': { tris: 12_000, errorStart: 5e-4, errorCap: 0.006 },
      'Jetson_Orin_nano (5)': { tris: 14_000, errorStart: 5e-4, errorCap: 0.005 },
      'Jetson_Orin_nano.001': { tris: 12_000, errorStart: 5e-4, errorCap: 0.005 },
      'Jetson_Orin_nano (4)': { tris: 8_000, errorStart: 5e-4, errorCap: 0.005 },
    },
    limits: { minTris: 0, maxTris: 140_000, maxBytes: 3_000_000 },
  },
];

const nodeRenames = {
  'Jetson_Orin_nano': 'mount-top',
  'Jetson_Orin_nano (1)': 'chassis-upper',
  'Jetson_Orin_nano (2)': 'chassis-lower',
  'Jetson_Orin_nano (4)': 'housing-rear',
  'Jetson_Orin_nano (5)': 'shell-rear',
  'jetson-orin-nano-super-dev-kit': 'jetson',
  'Plane.001': 'camera-ar0234',
  '8x8-Tof module': 'tof-8x8',
  'IMU': 'imu',
  'mic': 'mic-a',
  'mic.001': 'mic-b',
  'mic.002': 'mic-c',
};

const fmt = (n) => Math.round(n).toLocaleString('en-US');

function primTris(p) {
  const idx = p.getIndices();
  return idx ? idx.getCount() / 3 : (p.getAttribute('POSITION')?.getCount() ?? 0) / 3;
}
function meshTris(mesh) {
  return mesh.listPrimitives().reduce((acc, p) => acc + primTris(p), 0);
}

// Both pages hardcode the dark theme and null these textures out at runtime,
// so they are dead weight in the file. The 'mic' and 'tof-board' textures ARE
// sampled (the runtime grades over them) and must survive.
function stripDeadTextures(root) {
  for (const mat of root.listMaterials()) {
    const name = mat.getName();
    if (name === 'Black leather') {
      mat.setBaseColorTexture(null);
      mat.setNormalTexture(null);
      mat.setMetallicRoughnessTexture(null);
      const spec = mat.getExtension('KHR_materials_specular');
      if (spec) {
        spec.setSpecularTexture?.(null);
        spec.setSpecularColorTexture?.(null);
      }
    } else if (name === 'Black scratched plastic') {
      mat.setBaseColorTexture(null);
    }
  }
}

// Crease-angle normal reconstruction for meshes that went through the
// simplifier (indexed + position-welded at that point). Per vertex, incident
// faces are clustered with union-find — two faces join when their normals
// agree within `creaseDeg`. Each cluster gets ONE angle-weighted normal
// (angle weighting, not area, because meshopt leaves sliver triangles whose
// area weight would poison the average), and one output vertex is emitted per
// unique (vertexId, clusterId) so flat creases stay flat and curved surfaces
// stay smooth. Never run on unbudgeted/skipped meshes — those keep their
// authored normals and index buffers untouched.
export function creaseNormalsPrimitive(doc, prim, creaseDeg = 40) {
  const posAcc = prim.getAttribute('POSITION');
  const idxAcc = prim.getIndices();
  if (!posAcc || !idxAcc) throw new Error('creaseNormalsPrimitive requires indexed POSITION geometry');
  const rawPos = posAcc.getArray();
  const pos = rawPos instanceof Float32Array ? rawPos : new Float32Array(rawPos);
  const srcIdx = idxAcc.getArray();
  const cornerCount = srcIdx.length;
  const faceCount = cornerCount / 3;
  const vertCount = posAcc.getCount();
  const cosCrease = Math.cos((creaseDeg * Math.PI) / 180);

  // Per-face unit normals; zero-area (degenerate) faces are flagged and never
  // join a smoothing cluster.
  const faceN = new Float32Array(faceCount * 3);
  const faceOk = new Uint8Array(faceCount);
  for (let f = 0; f < faceCount; f++) {
    const ia = srcIdx[f * 3] * 3;
    const ib = srcIdx[f * 3 + 1] * 3;
    const ic = srcIdx[f * 3 + 2] * 3;
    const e1x = pos[ib] - pos[ia]; const e1y = pos[ib + 1] - pos[ia + 1]; const e1z = pos[ib + 2] - pos[ia + 2];
    const e2x = pos[ic] - pos[ia]; const e2y = pos[ic + 1] - pos[ia + 1]; const e2z = pos[ic + 2] - pos[ia + 2];
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-20) {
      faceN[f * 3] = nx / len;
      faceN[f * 3 + 1] = ny / len;
      faceN[f * 3 + 2] = nz / len;
      faceOk[f] = 1;
    }
  }

  // Per-corner weight = angle between the two edges meeting at that corner.
  const cornerW = new Float32Array(cornerCount);
  for (let c = 0; c < cornerCount; c++) {
    const f = (c / 3) | 0;
    const k = c % 3;
    const iv = srcIdx[c] * 3;
    const i1 = srcIdx[f * 3 + ((k + 1) % 3)] * 3;
    const i2 = srcIdx[f * 3 + ((k + 2) % 3)] * 3;
    const ux = pos[i1] - pos[iv]; const uy = pos[i1 + 1] - pos[iv + 1]; const uz = pos[i1 + 2] - pos[iv + 2];
    const vx = pos[i2] - pos[iv]; const vy = pos[i2 + 1] - pos[iv + 1]; const vz = pos[i2 + 2] - pos[iv + 2];
    const ul = Math.hypot(ux, uy, uz);
    const vl = Math.hypot(vx, vy, vz);
    if (ul > 1e-20 && vl > 1e-20) {
      const cosA = Math.min(1, Math.max(-1, (ux * vx + uy * vy + uz * vz) / (ul * vl)));
      cornerW[c] = Math.acos(cosA);
    }
  }

  // Vertex → incident-corner adjacency (CSR).
  const start = new Uint32Array(vertCount + 1);
  for (let c = 0; c < cornerCount; c++) start[srcIdx[c] + 1]++;
  for (let v = 0; v < vertCount; v++) start[v + 1] += start[v];
  const csr = new Uint32Array(cornerCount);
  const cursor = start.slice();
  for (let c = 0; c < cornerCount; c++) csr[cursor[srcIdx[c]]++] = c;

  const semantics = prim.listSemantics().filter((s) => s !== 'NORMAL');
  const outSrcVert = []; // source vertex id per output vertex
  const outNormal = []; // flat xyz per output vertex
  const newIdx = new Uint32Array(cornerCount);

  for (let v = 0; v < vertCount; v++) {
    const s0 = start[v];
    const s1 = start[v + 1];
    if (s0 === s1) continue; // unreferenced vertex — dropped

    // Unique incident faces (a degenerate face can use v at two corners).
    const uniqFaces = [];
    const faceSlot = new Map();
    for (let s = s0; s < s1; s++) {
      const f = (csr[s] / 3) | 0;
      if (!faceSlot.has(f)) {
        faceSlot.set(f, uniqFaces.length);
        uniqFaces.push(f);
      }
    }

    // Union-find over the vertex's incident faces.
    const parent = uniqFaces.map((_, i) => i);
    const find = (i) => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };
    for (let i = 0; i < uniqFaces.length; i++) {
      const fi = uniqFaces[i];
      if (!faceOk[fi]) continue;
      for (let j = i + 1; j < uniqFaces.length; j++) {
        const fj = uniqFaces[j];
        if (!faceOk[fj]) continue;
        const dot = faceN[fi * 3] * faceN[fj * 3]
          + faceN[fi * 3 + 1] * faceN[fj * 3 + 1]
          + faceN[fi * 3 + 2] * faceN[fj * 3 + 2];
        if (dot >= cosCrease) {
          const ri = find(i);
          const rj = find(j);
          if (ri !== rj) parent[rj] = ri;
        }
      }
    }

    // One angle-weighted normal per cluster.
    const accum = new Map(); // root -> [x, y, z]
    for (let s = s0; s < s1; s++) {
      const c = csr[s];
      const f = (c / 3) | 0;
      const r = find(faceSlot.get(f));
      let a = accum.get(r);
      if (!a) accum.set(r, (a = [0, 0, 0]));
      const w = cornerW[c];
      a[0] += faceN[f * 3] * w;
      a[1] += faceN[f * 3 + 1] * w;
      a[2] += faceN[f * 3 + 2] * w;
    }
    const rootOut = new Map(); // root -> output vertex id
    for (const [r, a] of accum) {
      let [x, y, z] = a;
      let len = Math.hypot(x, y, z);
      if (len < 1e-12) {
        // Degenerate cluster (zero-area faces, or opposing slivers): fall back
        // to an unweighted average, then to a fixed up vector.
        x = 0; y = 0; z = 0;
        for (let i = 0; i < uniqFaces.length; i++) {
          if (find(i) !== r) continue;
          const f = uniqFaces[i];
          x += faceN[f * 3]; y += faceN[f * 3 + 1]; z += faceN[f * 3 + 2];
        }
        len = Math.hypot(x, y, z);
        if (len < 1e-12) { x = 0; y = 0; z = 1; len = 1; }
      }
      rootOut.set(r, outSrcVert.length);
      outSrcVert.push(v);
      outNormal.push(x / len, y / len, z / len);
    }
    for (let s = s0; s < s1; s++) {
      const c = csr[s];
      newIdx[c] = rootOut.get(find(faceSlot.get((c / 3) | 0)));
    }
  }

  // Rebuild attributes: one output vertex per (vertexId, clusterId), all
  // existing attributes copied from the source vertex, plus the new NORMAL.
  const outCount = outSrcVert.length;
  const buffer = posAcc.getBuffer() ?? doc.getRoot().listBuffers()[0];
  for (const sem of semantics) {
    const acc = prim.getAttribute(sem);
    const el = acc.getElementSize();
    const src = acc.getArray();
    const dst = new src.constructor(outCount * el);
    for (let o = 0; o < outCount; o++) {
      const sv = outSrcVert[o];
      for (let k = 0; k < el; k++) dst[o * el + k] = src[sv * el + k];
    }
    prim.setAttribute(sem, doc.createAccessor(acc.getName(), buffer)
      .setType(acc.getType())
      .setNormalized(acc.getNormalized())
      .setArray(dst));
  }
  prim.setAttribute('NORMAL', doc.createAccessor('', buffer)
    .setType('VEC3')
    .setArray(new Float32Array(outNormal)));
  prim.setIndices(doc.createAccessor('', buffer)
    .setType('SCALAR')
    .setArray(newIdx));
}

// Last-resort guard for component-dense CAD (the Jetson dev-kit is ~1,872
// disconnected solids with a topology-preserving floor around 25 k tris).
// At the v2 budgets this should NEVER trigger — if it does, something is
// wrong upstream and the build shouts about it. Rebuilds the primitive's
// attributes to drop the vertices sloppy no longer references.
function sloppyPrimitive(doc, prim, targetTris, targetError = 0.05) {
  const posAcc = prim.getAttribute('POSITION');
  const rawPos = posAcc.getArray();
  const positions = rawPos instanceof Float32Array ? rawPos : new Float32Array(rawPos);
  const vcount = posAcc.getCount();
  const idxAcc = prim.getIndices();
  let src = idxAcc ? idxAcc.getArray() : null;
  if (!src) {
    src = new Uint32Array(vcount);
    for (let i = 0; i < vcount; i++) src[i] = i;
  }
  const idx = src instanceof Uint32Array ? src : Uint32Array.from(src);
  // simplifySloppy(indices, positions, stride, vertexLock, targetIndexCount, targetError)
  const target = Math.min(idx.length, Math.max(3, Math.floor(targetTris) * 3));
  const res = MeshoptSimplifier.simplifySloppy(idx, positions, 3, null, target, targetError);
  const newIdx = ArrayBuffer.isView(res) ? res : res[0];

  // Compact: keep only the vertices the new index buffer still references.
  const order = [];
  const map = new Map();
  const remap = new Uint32Array(newIdx.length);
  for (let i = 0; i < newIdx.length; i++) {
    const v = newIdx[i];
    let n = map.get(v);
    if (n === undefined) { n = order.length; map.set(v, n); order.push(v); }
    remap[i] = n;
  }
  for (const sem of prim.listSemantics()) {
    const acc = prim.getAttribute(sem);
    const el = acc.getElementSize();
    const a = acc.getArray();
    const dst = new a.constructor(order.length * el);
    for (let n = 0; n < order.length; n++) {
      const v = order[n];
      for (let c = 0; c < el; c++) dst[n * el + c] = a[v * el + c];
    }
    acc.setArray(dst);
  }
  if (idxAcc) idxAcc.setArray(remap);
  else prim.setIndices(doc.createAccessor().setType('SCALAR').setBuffer(posAcc.getBuffer()).setArray(remap));
}

// Names of meshes allowed to use the sloppy last-resort guard.
const SLOPPY = new Set(['jetson-orin-nano-super-dev-kit']);

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

async function build({ out, anchorsOut, tex, budgets, limits }) {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(SRC);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];

  // ---- 0. Strip textures the dark-theme runtime never samples ----
  stripDeadTextures(root);

  // ---- 1. Rename nodes/meshes/materials to clean slugs ----
  for (const node of root.listNodes()) {
    const nn = nodeRenames[node.getName()];
    if (nn) node.setName(nn);
  }
  for (const list of [root.listMeshes(), root.listMaterials(), root.listTextures()]) {
    for (const o of list) if (o.getName().startsWith('Screenshot')) o.setName('tof-board');
  }

  // ---- 2. Recenter + normalize scale under a new product root (height 2.0) ----
  const b = getBounds(scene);
  const center = b.min.map((mn, i) => (mn + b.max[i]) / 2);
  const height = b.max[1] - b.min[1];
  const s = 2.0 / height;
  const productRoot = doc.createNode('product-root')
    .setScale([s, s, s])
    .setTranslation([-center[0] * s, -center[1] * s, -center[2] * s]);
  for (const child of [...scene.listChildren()]) {
    scene.removeChild(child);
    productRoot.addChild(child);
  }
  scene.addChild(productRoot);

  // ---- 3. Optimize geometry ----
  await doc.transform(dedup(), prune(), weld());

  const report = [];
  const simplifiedMeshes = [];
  for (const mesh of root.listMeshes()) {
    const cfg = budgets[mesh.getName()];
    const before = meshTris(mesh);
    if (!cfg) {
      report.push({ name: mesh.getName(), before, after: before, budget: '—', action: 'full source' });
      continue;
    }
    // Within a whisker of budget: not worth trading authored normals for.
    if (before <= cfg.tris * 1.15) {
      report.push({ name: mesh.getName(), before, after: before, budget: cfg.tris, action: 'skipped (≤ budget×1.15)' });
      continue;
    }
    // CAD meshes ship split normals, so a bitwise weld can't merge and every
    // vertex is a locked simplifier border. Drop normals, weld by position,
    // simplify, rebuild crease-angle normals after.
    for (const prim of mesh.listPrimitives()) {
      prim.setAttribute('NORMAL', null);
      prim.setAttribute('TANGENT', null);
      weldPrimitive(prim);
    }
    // Aim straight at the budget each pass. Error stays at errorStart while
    // passes make progress and doubles only on a stall (many tiny CAD
    // components hit their per-component floor), capped at errorCap.
    let tris = meshTris(mesh);
    let error = cfg.errorStart;
    for (let attempt = 0; attempt < 14 && tris > cfg.tris; attempt++) {
      const ratio = Math.max(0.01, cfg.tris / tris);
      for (const prim of mesh.listPrimitives()) {
        simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error, lockBorder: false });
      }
      const next = meshTris(mesh);
      if (next >= tris - 8) error = Math.min(error * 2, cfg.errorCap);
      tris = next;
    }
    let action = 'simplified';
    if (tris > cfg.tris * 1.3 && SLOPPY.has(mesh.getName())) {
      console.warn('!'.repeat(74));
      console.warn(`!!! SLOPPY FALLBACK triggered for "${mesh.getName()}":`);
      console.warn(`!!! ${fmt(tris)} tris > 1.3× budget (${fmt(cfg.tris)}) after ${14} passes.`);
      console.warn('!!! This was expected NOT to happen at the v2 budgets — inspect visually.');
      console.warn('!'.repeat(74));
      const total = tris;
      for (const prim of mesh.listPrimitives()) {
        sloppyPrimitive(doc, prim, cfg.tris * (primTris(prim) / total), 0.05);
      }
      tris = meshTris(mesh);
      action = 'SLOPPY FALLBACK';
    }
    simplifiedMeshes.push(mesh);
    report.push({ name: mesh.getName(), before, after: Math.round(tris), budget: cfg.tris, action });
  }

  // ---- 3b. Crease-angle normal reconstruction, simplified meshes ONLY ----
  for (const mesh of simplifiedMeshes) {
    for (const prim of mesh.listPrimitives()) {
      creaseNormalsPrimitive(doc, prim, 40);
    }
  }

  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [tex, tex] }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );

  // ---- 4. Emit anchors (desktop only) ----
  if (anchorsOut) {
    const anchors = {};
    for (const node of root.listNodes()) {
      const name = node.getName();
      if (!name || !node.getMesh()) continue;
      const nb = getBounds(node);
      anchors[name] = {
        center: nb.min.map((mn, i) => +(((mn + nb.max[i]) / 2)).toFixed(4)),
        size: nb.min.map((mn, i) => +((nb.max[i] - mn)).toFixed(4)),
      };
    }
    const fb = getBounds(scene);
    anchors['__bounds__'] = { min: fb.min.map((v) => +v.toFixed(4)), max: fb.max.map((v) => +v.toFixed(4)) };
    writeFileSync(anchorsOut, JSON.stringify(anchors, null, 2));
  }

  // ---- 5. Report + assertions ----
  const nameW = Math.max(4, ...report.map((r) => r.name.length));
  console.log(`\n  ${'mesh'.padEnd(nameW)}  ${'before'.padStart(10)}  ${'after'.padStart(10)}  ${'budget'.padStart(8)}  action`);
  for (const r of report) {
    console.log(`  ${r.name.padEnd(nameW)}  ${fmt(r.before).padStart(10)}  ${fmt(r.after).padStart(10)}  ${(typeof r.budget === 'number' ? fmt(r.budget) : r.budget).padStart(8)}  ${r.action}`);
  }

  let total = 0;
  for (const mesh of root.listMeshes()) total += meshTris(mesh);
  await io.write(out, doc);
  const bytes = statSync(out).size;
  console.log(`Wrote ${out} — ${fmt(total)} tris, ${(bytes / 1e6).toFixed(2)} MB\n`);
  if (total < limits.minTris || total > limits.maxTris) {
    throw new Error(`${out}: total ${fmt(total)} tris outside [${fmt(limits.minTris)}, ${fmt(limits.maxTris)}]`);
  }
  if (bytes > limits.maxBytes) {
    throw new Error(`${out}: ${(bytes / 1e6).toFixed(2)} MB exceeds cap ${(limits.maxBytes / 1e6).toFixed(2)} MB`);
  }
}

// Run the build only when executed directly (the crease-normal function is
// imported by validation scripts).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  for (const v of VARIANTS) {
    console.log(`Building ${v.out} (tex ${v.tex})…`);
    await build(v);
  }
}
