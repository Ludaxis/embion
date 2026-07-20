import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup, prune, weld, weldPrimitive, simplifyPrimitive, textureCompress, meshopt, normals,
} from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

// Source CAD export (152 MB, ~1.65 M tris). Produces two web variants:
//   public/models/module.glb        — desktop  (~120 k tris, 1024px textures)
//   public/models/module-mobile.glb — phones   (~55 k tris, 512px textures)
// The runtime picks the mobile file on coarse-pointer / low-tier devices.
const SRC = '/Users/reza/Workspace/embion/path_planner_module.glb';

const VARIANTS = [
  {
    out: process.argv[2] ?? './public/models/module.glb',
    anchorsOut: process.argv[3] ?? './src/data/anchors.json',
    tex: 1024,
    // The Jetson dev-kit is ~60% of the raw tris and is only ever seen dimmed
    // and small during one chapter, so decimate it hard. Hero-visible sensor
    // faces (lidar cap, camera, mics) keep more budget.
    budgets: {
      'jetson-orin-nano-super-dev-kit': 40000,
      'lidar-ld19': 24000,
      'IMU': 12000,
      'Jetson_Orin_nano (5)': 12000,
      'Jetson_Orin_nano.001': 12000,
      'Jetson_Orin_nano (4)': 9000,
      'Jetson_Orin_nano (1)': 7000,
    },
  },
  {
    out: './public/models/module-mobile.glb',
    anchorsOut: null, // desktop anchors are authoritative; sizes match
    tex: 512,
    budgets: {
      'jetson-orin-nano-super-dev-kit': 12000,
      'lidar-ld19': 12000,
      'IMU': 6000,
      'Jetson_Orin_nano (5)': 6000,
      'Jetson_Orin_nano.001': 6000,
      'Jetson_Orin_nano (4)': 5000,
      'Jetson_Orin_nano (1)': 4000,
    },
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

function primTris(p) {
  const idx = p.getIndices();
  return idx ? idx.getCount() / 3 : (p.getAttribute('POSITION')?.getCount() ?? 0) / 3;
}
function meshTris(mesh) {
  return mesh.listPrimitives().reduce((acc, p) => acc + primTris(p), 0);
}

// Meshes made of hundreds of tiny disconnected CAD solids (the Jetson dev-kit)
// hit a per-component floor under topology-preserving simplify. Sloppy
// simplification ignores topology and welds across components — visually crude
// but fine for a part that is only ever seen small and dimmed. Rebuilds the
// primitive's attributes to drop the vertices sloppy no longer references.
function sloppyPrimitive(doc, prim, targetTris) {
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
  const res = MeshoptSimplifier.simplifySloppy(idx, positions, 3, null, target, 0.2);
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

// Names of meshes that need the sloppy fallback (component-dense hidden CAD).
const SLOPPY = new Set(['jetson-orin-nano-super-dev-kit']);

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

async function build({ out, anchorsOut, tex, budgets }) {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(SRC);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];

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

  for (const mesh of root.listMeshes()) {
    const budget = budgets[mesh.getName()];
    if (!budget) continue;
    // CAD meshes ship split normals, so a bitwise weld can't merge and every
    // vertex is a locked simplifier border. Drop normals, weld by position,
    // simplify, recompute normals after.
    for (const prim of mesh.listPrimitives()) {
      prim.setAttribute('NORMAL', null);
      prim.setAttribute('TANGENT', null);
      weldPrimitive(prim);
    }
    // Stall-escalating simplify: aim straight at the budget each pass, and when
    // a pass fails to remove triangles (many tiny CAD components hit their
    // per-component floor) push the error tolerance up hard until it collapses.
    let tris = meshTris(mesh);
    let error = 0.01;
    for (let attempt = 0; attempt < 14 && tris > budget; attempt++) {
      const ratio = Math.max(0.01, budget / tris);
      for (const prim of mesh.listPrimitives()) {
        simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error, lockBorder: false });
      }
      const next = meshTris(mesh);
      error = next >= tris - 8 ? error * 3 : error * 1.5; // escalate on stall
      tris = next;
    }
    // Component-limited mesh still way over budget → sloppy fallback.
    if (tris > budget * 1.3 && SLOPPY.has(mesh.getName())) {
      const total = tris;
      for (const prim of mesh.listPrimitives()) {
        sloppyPrimitive(doc, prim, budget * (primTris(prim) / total));
      }
      tris = meshTris(mesh);
    }
    console.log(`  ${mesh.getName()} -> ${Math.round(tris)} tris (budget ${budget})`);
  }

  await doc.transform(normals({ overwrite: false }));
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [tex, tex] }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
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

  let total = 0;
  for (const mesh of root.listMeshes()) total += meshTris(mesh);
  await io.write(out, doc);
  console.log(`Wrote ${out} — ${Math.round(total)} tris\n`);
}

for (const v of VARIANTS) {
  console.log(`Building ${v.out} (tex ${v.tex})…`);
  await build(v);
}
