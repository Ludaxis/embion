import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup, prune, weld, weldPrimitive, simplifyPrimitive, textureCompress, meshopt,
  mergeDocuments, unpartition,
} from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { writeFileSync, statSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// v5 LIGHT build (HYBRID pipeline, halved payload). Source CAD export is the
// NEW mechanical-detail export (134 MB — adds Node9 exposed PCB, Node1 camera
// assembly, 16 bolts, standoffs, mount plate) which is MISSING the finished
// AR0234 camera ('Plane.001', with the 'Glass dark' lens) and the 8x8 ToF
// board ('8x8-Tof module') that the ORIGINAL export had. Those two nodes are
// grafted in from GRAFT_SRC at their original world position (both exports
// share one coordinate space — verified at build time, aborts on mismatch).
//
// v5 deltas vs v3:
//   - 'Node1' (was renamed 'frame-detail', a rough duplicate camera assembly
//     the runtime HIDES) is dropped outright before budgeting — dead weight.
//   - Every budget re-derived from seen-size-on-screen: the jetson is mostly
//     enclosed, the lidar's crown is what reads; the chassis family gets
//     desktop budgets for the first time.
//   - The 'mic' retailer-photo texture is stripped from BOTH variants — the
//     runtime nulls it (ModuleModel 'mic' branch sets out.map = null).
//
// Produces two web variants:
//   public/models/module-v5.glb        — desktop (≤225 k instanced tris, ≤1.9 MB)
//   public/models/module-mobile-v5.glb — phones  (≤95 k instanced tris, ≤0.85 MB)
// The runtime picks the mobile file on coarse-pointer / low-tier devices.
// NOTE: /models/* ships with a 1-year immutable cache header, so output names
// are versioned (…-v5). Never overwrite a previously shipped filename — bump
// the suffix instead and leave the old files in place (module-v3/-mobile-v3
// stay on disk untouched).
const SRC = '/Users/reza/Workspace/embion/path_planner_module/path_planner_module.glb';

// Graft source for the finished camera + ToF board. The original 152 MB export
// (repo root) is preferred when present, but it went missing from disk on
// 2026-07-22 (not in Trash / snapshots / Spotlight). Fallback: the shipped v2
// desktop build — BOTH graft meshes passed through that build untouched (they
// had no simplify budget, so they carry full source geometry with authored
// normals), and its only lossy deltas are ones v3 applies anyway ('Black
// scratched plastic' baseColor already stripped, textures already ≤1024 WebP,
// positions meshopt-quantized ≈ 1e-4 of extent).
const GRAFT_SRC_PRIMARY = '/Users/reza/Workspace/embion/path_planner_module.glb';
// Committed copy of the v2 build (the deleted public/models/module-v2.glb,
// restorable via `git show 1c72f2f:landing/public/models/module-v2.glb`).
// It carries the finished camera-ar0234 + tof-8x8 the new export lacks.
const GRAFT_SRC_FALLBACK = './scripts/graft-source.glb';

// Nodes whose bounds must agree between SRC and the graft source before any
// grafting happens (same rigid assembly in both exports). Names differ in the
// fallback because the v2 build already ran the slug renames.
const CHECK_NODES = [
  { src: 'lidar-ld19', primary: 'lidar-ld19', fallback: 'lidar-ld19' },
  { src: 'IMU', primary: 'IMU', fallback: 'imu' },
  { src: 'mic', primary: 'mic', fallback: 'mic-a' },
];
const COORD_TOLERANCE = 0.01; // fraction of SRC bounding-box diagonal

// Per-mesh budgets: { tris, errorStart, errorCap }. `error` starts at
// errorStart and doubles ONLY when a pass stalls, capped at errorCap — it
// never grows on a successful pass. Meshes absent from the map (and meshes
// already within budget×1.15) ship full source geometry with their authored
// split normals and index buffers untouched. Budgets are keyed by the
// post-rename MESH slugs (see renameMeshesToSlugs): the 16 bolt nodes share
// ONE mesh (slug 'bolt'), so its budget is per-mesh and every instance renders
// that count; same for the 4 'standoff' instances and the 3 'mic' instances.
const VARIANTS = [
  {
    out: process.argv[2] ?? './public/models/module-v5.glb',
    anchorsOut: process.argv[3] ?? './src/data/anchors.json',
    tex: 1024,
    budgets: {
      // Seen-size budgets: the jetson sits mostly enclosed behind the shells,
      // the lidar's crown is the part that reads at hero/chapter framing.
      'jetson': { tris: 45_000, errorStart: 1e-3, errorCap: 0.012 },
      'lidar-ld19': { tris: 45_000, errorStart: 5e-4, errorCap: 0.006 },
      'imu': { tris: 15_000, errorStart: 5e-4, errorCap: 0.008 },
      'pcb-core': { tris: 18_000, errorStart: 5e-4, errorCap: 0.008 },
      'mount-detail': { tris: 5_000, errorStart: 5e-4, errorCap: 0.008 },
      // errorCap escalated 0.02 → 0.04 (2×): at 0.02 the bolt stalled at 630.
      'bolt': { tris: 500, errorStart: 1e-3, errorCap: 0.04 },
      // Chassis family now budgeted on desktop too (was full source in v3).
      // chassis-upper stays full (8,894) — it frames every chapter shot.
      'shell-rear': { tris: 14_000, errorStart: 5e-4, errorCap: 0.006 },
      'mount-top': { tris: 12_000, errorStart: 5e-4, errorCap: 0.006 },
      'housing-rear': { tris: 8_000, errorStart: 5e-4, errorCap: 0.006 },
    },
    // Budgeted 170 k + full-source remainder ≈ 19 k → ≈ 189 k expected.
    limits: { minTris: 170_000, maxTris: 225_000, maxBytes: 1_900_000 },
  },
  {
    out: './public/models/module-mobile-v5.glb',
    anchorsOut: null, // desktop anchors are authoritative; sizes match
    tex: 512,
    budgets: {
      // jetson + bolt hit their topology-preservation floor ABOVE the mobile
      // budget (jetson 38,837, bolt 920 — identical results at 1× and 2×
      // errorCap, so error was not the binding constraint). Opt them into the
      // sloppy pass, the same remedy the v1 pipeline used for the mobile
      // jetson: simplifySloppy ignores topology, acceptable at phone size.
      // NOTE: 16 k (not the drafted 18 k) — the full-source remainder
      // (chassis-lower + 3 mics + camera + tof + 4 standoffs ≈ 10 k) pushes
      // an 18 k jetson past the 95 k file cap; the enclosed jetson is the
      // cheapest place to claw those tris back.
      'jetson': { tris: 16_000, errorStart: 1e-3, errorCap: 0.02, sloppy: true },
      'lidar-ld19': { tris: 18_000, errorStart: 5e-4, errorCap: 0.004 },
      'imu': { tris: 8_000, errorStart: 5e-4, errorCap: 0.006 },
      // errorCap escalated 0.006 → 0.012 (2×): at 0.006 pcb-core stalled at
      // 9,191 (component-dense board, many per-component floors).
      'pcb-core': { tris: 8_000, errorStart: 5e-4, errorCap: 0.012 },
      'mount-detail': { tris: 3_000, errorStart: 5e-4, errorCap: 0.006 },
      // sloppyError 0.15: at the default 0.05 the sloppy pass was error-bound
      // and landed at 808 tris/bolt (12.9 k instanced — single biggest bust of
      // the 95 k cap). Probed on the built mesh: 0.05→776, 0.1→468, 0.15→255
      // (its floor; 0.2–0.5 identical). Bolts are ~3% of model height on a
      // phone — topology-free 255-tri bolts are invisible at that size.
      'bolt': { tris: 300, errorStart: 1e-3, errorCap: 0.04, sloppy: true, sloppyError: 0.15 },
      'shell-rear': { tris: 8_000, errorStart: 5e-4, errorCap: 0.005 },
      'mount-top': { tris: 7_000, errorStart: 5e-4, errorCap: 0.005 },
      'housing-rear': { tris: 5_000, errorStart: 5e-4, errorCap: 0.005 },
      'chassis-upper': { tris: 6_000, errorStart: 5e-4, errorCap: 0.006 },
    },
    // Budgeted ≈ 83.8 k + full-source remainder ≈ 10 k → ≈ 94 k expected.
    limits: { minTris: 85_000, maxTris: 95_000, maxBytes: 850_000 },
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
  // New-export mechanical detail nodes.
  'Node9': 'pcb-core', // exposed PCB (many hex-named colored materials)
  // 'Node1' (v3's 'frame-detail', the rough camera assembly in the camera
  // bay) is DROPPED before budgeting — see DROP_NODES. The runtime hides it
  // (duplicate of the grafted finished camera), so it never ships in v5.
  'Cube.050': 'mount-detail',
  'Cylinder.002': 'standoff-a',
  'Cylinder.004': 'standoff-b',
  'Cylinder.005': 'standoff-c',
  'Cylinder.007': 'standoff-d',
};
// Bolt.038…Bolt.053 → bolt-01…bolt-16 in ascending order.
for (let i = 0; i < 16; i++) {
  nodeRenames[`Bolt.${String(38 + i).padStart(3, '0')}`] = `bolt-${String(i + 1).padStart(2, '0')}`;
}

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const r4 = (a) => a.map((v) => +v.toFixed(4));

function primTris(p) {
  const idx = p.getIndices();
  return idx ? idx.getCount() / 3 : (p.getAttribute('POSITION')?.getCount() ?? 0) / 3;
}
function meshTris(mesh) {
  return mesh.listPrimitives().reduce((acc, p) => acc + primTris(p), 0);
}
// Instanced triangle count: every node that references a mesh counts the full
// mesh (the bolts render 16×, the standoffs 4×, the mics 3×).
function sceneTris(scene) {
  let total = 0;
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (mesh) total += meshTris(mesh);
  });
  return total;
}

// Exact world-space AABB of a node's OWN mesh (NAMED children excluded —
// unlike getBounds, which folds child nodes in; chassis-upper parents the
// mics and its anchor must not swallow them). UNNAMED children are folded in:
// quantize() parks a mesh on an unnamed helper child when the owning node has
// children (the dequant transform can't go on the parent), so an unnamed
// child's mesh semantically belongs to the named part. Reads via getElement
// so quantized (normalized) POSITION data is decoded correctly.
function ownMeshBounds(node) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const el = [0, 0, 0];
  const accumulate = (n) => {
    const mesh = n.getMesh();
    if (!mesh) return;
    const m = n.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      for (let i = 0, c = pos.getCount(); i < c; i++) {
        pos.getElement(i, el);
        const [x, y, z] = el;
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        if (wx < min[0]) min[0] = wx; if (wx > max[0]) max[0] = wx;
        if (wy < min[1]) min[1] = wy; if (wy > max[1]) max[1] = wy;
        if (wz < min[2]) min[2] = wz; if (wz > max[2]) max[2] = wz;
      }
    }
  };
  accumulate(node);
  for (const child of node.listChildren()) {
    if (!child.getName()) accumulate(child);
  }
  return min[0] === Infinity ? null : { min, max };
}

// Nodes shipped in v3 that the runtime unconditionally hides — pure dead
// bytes. Disposed (with descendants) right after the source is read, so they
// never enter budgeting, normalization, anchors, or the outputs. Hard-fails
// if a future export loses the node, so the drop gets reconsidered instead
// of silently no-opping.
const DROP_NODES = ['Node1']; // v3's 'frame-detail': duplicate rough camera
function dropDeadNodes(root) {
  for (const name of DROP_NODES) {
    const node = root.listNodes().find((n) => n.getName() === name);
    if (!node) throw new Error(`DROP_NODES: "${name}" not found in source`);
    const junk = [];
    node.traverse((n) => junk.push(n));
    for (const n of junk) n.dispose();
  }
}

// Both pages hardcode the dark theme and null these textures out at runtime,
// so they are dead weight in the file. The 'tof-board' texture IS sampled
// (the runtime grades over it) and must survive, as are the two new-export
// board photos (IMU / mount-detail, 'Screenshot …'). The 'mic' texture is
// dead as of the dark-theme pass: ModuleModel's 'mic' branch sets
// out.map = null (retailer product photo — killed in favor of PCB-green).
function stripDeadTextures(root) {
  for (const mat of root.listMaterials()) {
    const name = mat.getName();
    if (name === 'mic') {
      mat.setBaseColorTexture(null);
    } else if (name === 'Black leather') {
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

// ---- Graft: bring the finished camera + ToF board into the new document ----
//
// Reads the graft source, verifies both exports share one coordinate space
// (CHECK_NODES bounds must agree within COORD_TOLERANCE of the SRC diagonal —
// hard abort otherwise), then mergeDocuments + reparent the two wanted nodes
// under the main scene root. Their local TRS is preserved: in the primary
// source they live at the scene root (raw space), in the v2 fallback they are
// children of the v2 'product-root' whose normalize transform is exactly what
// reparenting discards — either way the copy lands at the original raw-space
// world position. Everything else from the merged-in scene is disposed and
// later pruned. Returns raw-space bounds of the grafted nodes for the
// post-normalize placement verification.
async function graftFinishedSensors(io, doc) {
  const graftPath = existsSync(GRAFT_SRC_PRIMARY) ? GRAFT_SRC_PRIMARY : GRAFT_SRC_FALLBACK;
  const fromV2 = graftPath !== GRAFT_SRC_PRIMARY;
  const graftDoc = await io.read(graftPath);
  const graftRoot = graftDoc.getRoot();
  const findNode = (root, name) => root.listNodes().find((n) => n.getName() === name);

  // Fallback docs are in normalized space — unwrap their product-root
  // (world = raw·s + t, uniform s) to compare/land in raw source space.
  let unwrap = (b) => b;
  if (fromV2) {
    const pr = findNode(graftRoot, 'product-root');
    if (!pr) throw new Error(`${graftPath}: expected a product-root node`);
    const t = pr.getTranslation();
    const s = pr.getScale()[0];
    unwrap = (b) => ({
      min: b.min.map((v, i) => (v - t[i]) / s),
      max: b.max.map((v, i) => (v - t[i]) / s),
    });
  }

  // ---- Coordinate-space check (abort criterion) ----
  const srcScene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const sb = getBounds(srcScene);
  const diag = Math.hypot(...sb.max.map((v, i) => v - sb.min[i]));
  console.log(`  graft source: ${graftPath}${fromV2 ? ' (v2 fallback — original export missing)' : ''}`);
  for (const { src, primary, fallback } of CHECK_NODES) {
    const a = getBounds(findNode(doc.getRoot(), src));
    const b = unwrap(getBounds(findNode(graftRoot, fromV2 ? fallback : primary)));
    const worst = Math.max(
      ...a.min.map((v, i) => Math.abs(v - b.min[i])),
      ...a.max.map((v, i) => Math.abs(v - b.max[i])),
    );
    const rel = worst / diag;
    console.log(`  coord check ${src.padEnd(10)} worst-axis Δ ${worst.toFixed(5)} (${(100 * rel).toFixed(3)}% of diagonal)`);
    if (rel > COORD_TOLERANCE) {
      console.error(`COORDINATE-SPACE MISMATCH on "${src}" — graft aborted, nothing written.`);
      console.error(`  SRC   bounds: min ${r4(a.min)} max ${r4(a.max)}`);
      console.error(`  graft bounds: min ${r4(b.min)} max ${r4(b.max)}`);
      console.error(`  worst-axis delta ${worst} > ${COORD_TOLERANCE} × diagonal (${diag.toFixed(3)})`);
      process.exit(1);
    }
  }

  const wanted = fromV2
    ? ['camera-ar0234', 'tof-8x8']
    : ['Plane.001', '8x8-Tof module'];

  // Scoped renames on the PRIMARY graft doc only: the ToF board photo exports
  // as 'Screenshot …'. This rename must never run on the main doc — the new
  // export has its own 'Screenshot …' board photos (IMU, mount-detail) that
  // are NOT the ToF board. The fallback doc is already renamed.
  if (!fromV2) {
    for (const list of [graftRoot.listMeshes(), graftRoot.listMaterials(), graftRoot.listTextures()]) {
      for (const o of list) if (o.getName().startsWith('Screenshot')) o.setName('tof-board');
    }
  }

  // Record raw-space bounds of the graft targets for later verification.
  const graftRaw = {};
  for (const name of wanted) {
    const node = findNode(graftRoot, name);
    if (!node) throw new Error(`${graftPath}: graft node "${name}" not found`);
    graftRaw[nodeRenames[name] ?? name] = unwrap(getBounds(node));
  }

  // ---- Merge + reparent + dispose the rest ----
  const root = doc.getRoot();
  const scenesBefore = root.listScenes().length;
  mergeDocuments(doc, graftDoc);
  const mainScene = root.listScenes()[0];
  const graftScenes = root.listScenes().slice(scenesBefore);
  for (const name of wanted) {
    const node = findNode(root, name); // unique: SRC has no node by these names
    if (!node) throw new Error(`merge lost graft node "${name}"`);
    mainScene.addChild(node); // re-parents; local TRS (raw placement) kept
  }
  for (const scene of graftScenes) {
    const junk = [];
    scene.traverse((n) => junk.push(n));
    for (const n of junk) n.dispose();
    scene.dispose();
  }
  // Merged docs carry a second buffer; GLB output requires exactly one.
  await doc.transform(unpartition());
  return { graftPath, fromV2, graftRaw };
}

// Budgets are keyed by mesh slug. After node renames, give each mesh its
// node's slug when used by exactly one node; instanced meshes get a family
// slug ('bolt' ×16, 'standoff' ×4; 'mic' ×3 already has a clean name).
function renameMeshesToSlugs(root) {
  const users = new Map();
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    if (!users.has(mesh)) users.set(mesh, []);
    users.get(mesh).push(node.getName());
  }
  for (const [mesh, names] of users) {
    if (names.length === 1 && names[0]) mesh.setName(names[0]);
    else if (names.every((n) => n.startsWith('bolt-'))) mesh.setName('bolt');
    else if (names.every((n) => n.startsWith('standoff-'))) mesh.setName('standoff');
  }
  return users;
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
// At the v5 budgets this should NEVER trigger — if it does, something is
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

// Names of meshes allowed to use the sloppy last-resort guard (post-rename slug).
const SLOPPY = new Set(['jetson']);

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

async function build({ out, anchorsOut, tex, budgets, limits }) {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(SRC);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];

  // ---- 0. Drop runtime-hidden geometry (Node1 / v3's 'frame-detail') ----
  // Before ANYTHING else: it must not influence the graft coord check, the
  // normalize transform, budgeting, or anchors. (Node1 is interior to the
  // assembly, so scene bounds — and hence the normalize — do not move.)
  dropDeadNodes(root);

  // ---- 0a. Graft the finished camera + ToF board (aborts on coord mismatch) ----
  const { graftRaw } = await graftFinishedSensors(io, doc);

  // ---- 0b. Strip textures the dark-theme runtime never samples ----
  stripDeadTextures(root);

  // ---- 1. Rename nodes to clean slugs, then meshes to their node slugs ----
  for (const node of root.listNodes()) {
    const nn = nodeRenames[node.getName()];
    if (nn) node.setName(nn);
  }
  renameMeshesToSlugs(root);

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

  // ---- 2b. Verify graft placement: raw graft bounds mapped through the ----
  //          normalize transform must equal the grafted nodes' world bounds.
  const mapRaw = (p) => p.map((v, i) => v * s - center[i] * s);
  const normDiag = Math.hypot(...getBounds(scene).max.map((v, i) => v - getBounds(scene).min[i]));
  for (const [name, raw] of Object.entries(graftRaw)) {
    const node = root.listNodes().find((n) => n.getName() === name);
    if (!node) throw new Error(`graft node "${name}" missing after renames`);
    const actual = getBounds(node);
    const expected = { min: mapRaw(raw.min), max: mapRaw(raw.max) };
    const worst = Math.max(
      ...actual.min.map((v, i) => Math.abs(v - expected.min[i])),
      ...actual.max.map((v, i) => Math.abs(v - expected.max[i])),
    );
    console.log(`  graft verify ${name.padEnd(13)} worst-axis Δ ${worst.toFixed(5)} `
      + `(expected ctr ${r4(expected.min.map((v, i) => (v + expected.max[i]) / 2))})`);
    if (worst > 0.005 * normDiag) {
      throw new Error(`graft verify failed for "${name}": worst-axis delta ${worst} in normalized space`);
    }
  }

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
    const optIn = cfg.sloppy && tris > cfg.tris * 1.15; // intended (topology floor > budget)
    const lastResort = !optIn && tris > cfg.tris * 1.3 && SLOPPY.has(mesh.getName());
    if (optIn || lastResort) {
      if (lastResort) {
        console.warn('!'.repeat(74));
        console.warn(`!!! SLOPPY FALLBACK triggered for "${mesh.getName()}":`);
        console.warn(`!!! ${fmt(tris)} tris > 1.3× budget (${fmt(cfg.tris)}) after ${14} passes.`);
        console.warn('!!! This was expected NOT to happen at the v5 budgets — inspect visually.');
        console.warn('!'.repeat(74));
      }
      const total = tris;
      for (const prim of mesh.listPrimitives()) {
        sloppyPrimitive(doc, prim, cfg.tris * (primTris(prim) / total), cfg.sloppyError ?? 0.05);
      }
      tris = meshTris(mesh);
      action = optIn ? 'sloppy (opt-in)' : 'SLOPPY FALLBACK';
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

  // ---- 4. Emit anchors (desktop only) — own-mesh bounds per named node ----
  if (anchorsOut) {
    const anchors = {};
    for (const node of root.listNodes()) {
      const name = node.getName();
      if (!name || name === 'product-root') continue;
      const nb = ownMeshBounds(node); // null when neither the node nor an unnamed helper child has a mesh
      if (!nb) continue;
      anchors[name] = {
        center: nb.min.map((mn, i) => +(((mn + nb.max[i]) / 2)).toFixed(4)),
        size: nb.min.map((mn, i) => +((nb.max[i] - mn)).toFixed(4)),
      };
    }
    const fb = getBounds(scene);
    anchors['__bounds__'] = { min: fb.min.map((v) => +v.toFixed(4)), max: fb.max.map((v) => +v.toFixed(4)) };
    writeFileSync(anchorsOut, JSON.stringify(anchors, null, 2));
  }

  // ---- 5. Report + assertions (instanced totals: bolts render 16×, etc.) ----
  const nameW = Math.max(4, ...report.map((r) => r.name.length));
  console.log(`\n  ${'mesh'.padEnd(nameW)}  ${'before'.padStart(10)}  ${'after'.padStart(10)}  ${'budget'.padStart(8)}  action`);
  for (const r of report) {
    console.log(`  ${r.name.padEnd(nameW)}  ${fmt(r.before).padStart(10)}  ${fmt(r.after).padStart(10)}  ${(typeof r.budget === 'number' ? fmt(r.budget) : r.budget).padStart(8)}  ${r.action}`);
  }

  // v5 invariants: the dropped node and dead texture must not resurface, and
  // the grafted finished sensors must have survived the transform chain.
  for (const node of root.listNodes()) {
    const n = node.getName();
    if (n === 'frame-detail' || n === 'Node1') throw new Error(`${out}: dropped node "${n}" resurfaced`);
  }
  for (const mesh of root.listMeshes()) {
    const n = mesh.getName();
    if (n === 'frame-detail' || n === 'Node1') throw new Error(`${out}: dropped mesh "${n}" resurfaced`);
  }
  if (root.listTextures().some((t) => t.getName() === 'mic')) {
    throw new Error(`${out}: dead 'mic' texture still present`);
  }
  for (const wanted of ['camera-ar0234', 'tof-8x8']) {
    const node = root.listNodes().find((n) => n.getName() === wanted);
    if (!node?.getMesh()?.listPrimitives().every((p) => p.getMaterial())) {
      throw new Error(`${out}: graft "${wanted}" missing (or lost its material)`);
    }
  }

  const total = sceneTris(scene);
  await io.write(out, doc);
  const bytes = statSync(out).size;
  console.log(`Wrote ${out} — ${fmt(total)} instanced tris, ${(bytes / 1e6).toFixed(2)} MB\n`);
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
