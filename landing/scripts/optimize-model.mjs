import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup, prune, weld, weldPrimitive, simplifyPrimitive, textureCompress, meshopt, normals,
} from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const SRC = '/Users/reza/Workspace/embion/path_planner_module.glb';
const OUT = process.argv[2] ?? './module.glb';
const ANCHORS_OUT = process.argv[3] ?? './anchors.json';

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });
const doc = await io.read(SRC);
const root = doc.getRoot();
const scene = root.getDefaultScene() ?? root.listScenes()[0];

// ---- 1. Rename nodes/meshes/materials to clean slugs ----
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
for (const node of root.listNodes()) {
  const nn = nodeRenames[node.getName()];
  if (nn) node.setName(nn);
}
for (const mesh of root.listMeshes()) {
  if (mesh.getName().startsWith('Screenshot')) mesh.setName('tof-board');
}
for (const mat of root.listMaterials()) {
  if (mat.getName().startsWith('Screenshot')) mat.setName('tof-board');
}
for (const tex of root.listTextures()) {
  if (tex.getName().startsWith('Screenshot')) tex.setName('tof-board');
}

// ---- 2. Recenter + normalize scale under a new product root ----
const b = getBounds(scene);
const center = b.min.map((mn, i) => (mn + b.max[i]) / 2);
const height = b.max[1] - b.min[1];
const s = 2.0 / height; // normalize so model height == 2.0 world units

const productRoot = doc.createNode('product-root')
  .setScale([s, s, s])
  .setTranslation([-center[0] * s, -center[1] * s, -center[2] * s]);
for (const child of [...scene.listChildren()]) {
  scene.removeChild(child);
  productRoot.addChild(child);
}
scene.addChild(productRoot);

// ---- 3. Optimize geometry ----
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

await doc.transform(dedup(), prune(), weld());

// Per-mesh triangle budgets: aggressive on hidden/dense CAD parts,
// gentle on hero-visible sensor faces.
const budgets = {
  'jetson-orin-nano-super-dev-kit': 110000,
  'lidar-ld19': 60000,
  'IMU': 14000,
  'Jetson_Orin_nano (5)': 16000,
  'Jetson_Orin_nano.001': 14000,
};

function meshTris(mesh) {
  return mesh.listPrimitives().reduce((acc, p) => {
    const idx = p.getIndices();
    return acc + (idx ? idx.getCount() / 3 : (p.getAttribute('POSITION')?.getCount() ?? 0) / 3);
  }, 0);
}

for (const mesh of root.listMeshes()) {
  const budget = budgets[mesh.getName()];
  if (!budget) continue;
  // CAD-derived meshes ship split normals, so bitwise weld can't merge and
  // every vertex becomes a locked border for the simplifier. Drop normals,
  // weld by position, simplify, recompute normals afterwards.
  for (const prim of mesh.listPrimitives()) {
    prim.setAttribute('NORMAL', null);
    prim.setAttribute('TANGENT', null);
    weldPrimitive(prim);
  }
  let tris = meshTris(mesh);
  let error = 0.001;
  let attempts = 0;
  while (tris > budget && attempts < 8) {
    const ratio = Math.max(0.02, (budget / tris) * 0.9);
    for (const prim of mesh.listPrimitives()) {
      simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error });
    }
    tris = meshTris(mesh);
    error *= 2.2;
    attempts++;
  }
  console.log(`simplified ${mesh.getName()} -> ${Math.round(tris)} tris (budget ${budget}, final error ${error.toFixed(4)})`);
}

await doc.transform(normals({ overwrite: false }));

await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [1024, 1024] }),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);

// ---- 4. Emit anchors (post-transform world-space part centers) ----
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
const finalBounds = getBounds(scene);
anchors['__bounds__'] = {
  min: finalBounds.min.map((v) => +v.toFixed(4)),
  max: finalBounds.max.map((v) => +v.toFixed(4)),
};

let totalTris = 0;
for (const mesh of root.listMeshes()) totalTris += meshTris(mesh);
console.log(`TOTAL TRIS: ${Math.round(totalTris)}`);

await io.write(OUT, doc);
writeFileSync(ANCHORS_OUT, JSON.stringify(anchors, null, 2));
console.log('Wrote', OUT, 'and', ANCHORS_OUT);
