import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { motion } from '../lib/motion';

export const MODEL_URL = '/models/module.glb';
useGLTF.preload(MODEL_URL);

/** Part slugs present in the GLB (node names). */
export const PART_NAMES = [
  'mount-top',
  'chassis-upper',
  'chassis-lower',
  'housing-rear',
  'shell-rear',
  'jetson',
  'camera-ar0234',
  'tof-8x8',
  'lidar-ld19',
  'imu',
  'mic-a',
  'mic-b',
  'mic-c',
] as const;

/** Which parts light up together when a chapter focuses one anchor. */
const FOCUS_GROUPS: Record<string, string[]> = {
  'lidar-ld19': ['lidar-ld19'],
  imu: ['imu'],
  'mic-b': ['mic-a', 'mic-b', 'mic-c'],
  'camera-ar0234': ['camera-ar0234'],
  'tof-8x8': ['tof-8x8'],
  jetson: ['jetson', 'housing-rear'],
  'chassis-upper': [...PART_NAMES],
};

/** World-space exploded-view offsets (V2 explode + part extraction). */
export const EXPLODE: Record<string, [number, number, number]> = {
  'lidar-ld19': [0, 0.55, 0],
  imu: [0, 0.95, 0],
  'mount-top': [0, 0.25, 0],
  'mic-a': [0.55, 0, 0],
  'mic-c': [-0.55, 0, 0],
  'mic-b': [0, 0, -0.5],
  'camera-ar0234': [0, 0, -0.65],
  'tof-8x8': [0, -0.25, -0.85],
  jetson: [0, 0, 0.75],
  'housing-rear': [0, 0, 0.4],
  'shell-rear': [0, 0, 1.2],
  'chassis-lower': [0, -0.15, 0],
};

/** Solo-extraction escape vectors. Defaults to EXPLODE, overridden where the
 *  exploded direction would drive a lone part through its neighbours:
 *  the LiDAR sits directly under the IMU plate (escape = forward), and the
 *  Jetson must travel far enough to fully clear the rear shell. */
export const EXTRACT_VECTORS: Record<string, [number, number, number]> = {
  ...EXPLODE,
  'lidar-ld19': [0, 0.1, -0.85],
  jetson: [0, 0, 0.95],
};

/** Live registry so overlays can project real (spun/exploded) positions.
 *  anchorLocal is the part's bounds center in its own local space — several
 *  CAD meshes ship world-baked geometry with zero node translation, so the
 *  node origin is NOT the part. */
export const partRegistry = new Map<
  string,
  { obj: THREE.Object3D; anchorLocal: THREE.Vector3 }
>();

type Props = {
  theme: 'dark' | 'light';
  /** darken = cinematic dim; fade = blueprint ghosting */
  dimStyle?: 'darken' | 'fade';
  /** override the GLB URL (render rig comparison: ?model=…) */
  url?: string;
};

export function ModuleModel({ theme, dimStyle = 'darken', url = MODEL_URL }: Props) {
  const { scene } = useGLTF(url);
  const rootRef = useRef<THREE.Group>(null);

  // Clone the scene graph + materials once per mount so theme/dim mutations
  // never leak through the global useGLTF cache (shared across pages).
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const seen = new Map<THREE.Material, THREE.Material>();
    c.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const clones = mats.map((m) => {
        if (!seen.has(m)) seen.set(m, gradeMaterial(m.clone() as THREE.MeshStandardMaterial, theme));
        return seen.get(m)!;
      });
      mesh.material = Array.isArray(mesh.material) ? clones : clones[0];
    });
    return c;
  }, [scene, theme]);

  type PartState = {
    obj: THREE.Object3D;
    basePos: THREE.Vector3;
    explodeLocal: THREE.Vector3;
    extractLocal: THREE.Vector3;
    materials: { mat: THREE.Material & { color?: THREE.Color }; baseColor: THREE.Color }[];
    dim: number; // damped 0..1 (1 = fully present)
  };

  const parts = useMemo(() => {
    const map = new Map<string, PartState>();
    const productRoot = cloned.getObjectByName('product-root');
    const rootScale = productRoot ? productRoot.scale.x : 1;
    for (const name of PART_NAMES) {
      const obj = cloned.getObjectByName(name);
      if (!obj) continue;
      const materials: PartState['materials'] = [];
      // Per-part material uniqueness: chassis parts share a filament material,
      // so clone again per part for independent dimming.
      obj.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const clones = mats.map((m) => m.clone());
        mesh.material = Array.isArray(mesh.material) ? clones : clones[0];
        for (const m of clones) {
          const mat = m as THREE.MeshStandardMaterial;
          if (mat.color) materials.push({ mat, baseColor: mat.color.clone() });
          if (dimStyle === 'fade') {
            mat.transparent = true;
            mat.opacity = 1;
          }
        }
      });
      const ex = EXPLODE[name] ?? [0, 0, 0];
      const exv = EXTRACT_VECTORS[name] ?? [0, 0, 0];
      map.set(name, {
        obj,
        basePos: obj.position.clone(),
        explodeLocal: new THREE.Vector3(ex[0], ex[1], ex[2]).divideScalar(rootScale),
        extractLocal: new THREE.Vector3(exv[0], exv[1], exv[2]).divideScalar(rootScale),
        materials,
        dim: 1,
      });
      cloned.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      const anchorLocal = obj.worldToLocal(box.getCenter(new THREE.Vector3()));
      partRegistry.set(name, { obj, anchorLocal });
    }
    return map;
  }, [cloned, dimStyle]);

  useEffect(
    () => () => {
      for (const name of PART_NAMES) partRegistry.delete(name);
    },
    [],
  );

  const dimTarget = dimStyle === 'fade' ? 0.14 : 0.45;

  useFrame((state, dt) => {
    // Spin around the cloned scene root — its origin is the world origin.
    // (product-root carries the centering translation, so rotating IT would
    // swing the model on a 12-unit arm.)
    cloned.rotation.y = motion.spin + motion.spinDrag;

    const focusSet = motion.focus ? FOCUS_GROUPS[motion.focus] ?? [motion.focus] : null;

    const extractSet =
      motion.extractName && motion.extractName !== 'chassis-upper'
        ? FOCUS_GROUPS[motion.extractName] ?? [motion.extractName]
        : null;

    for (const [name, p] of parts) {
      // global exploded view + single-part extraction (separate vectors:
      // extraction follows a collision-free escape path)
      p.obj.position
        .copy(p.basePos)
        .addScaledVector(p.explodeLocal, easeInOut(motion.explode));
      if (extractSet && extractSet.includes(name)) {
        p.obj.position.addScaledVector(p.extractLocal, easeInOut(motion.extract));
      }

      // focus dimming
      const target = !focusSet || focusSet.includes(name) ? 1 : dimTarget;
      p.dim = THREE.MathUtils.damp(p.dim, target, 6, dt);
      for (const { mat, baseColor } of p.materials) {
        if (dimStyle === 'fade') {
          (mat as THREE.MeshStandardMaterial).opacity = p.dim;
        } else if ((mat as THREE.MeshStandardMaterial).color) {
          (mat as THREE.MeshStandardMaterial).color
            .copy(baseColor)
            .multiplyScalar(p.dim);
        }
      }
    }
  });

  return <primitive ref={rootRef} object={cloned} />;
}

function easeInOut(t: number) {
  return t * t * (3 - 2 * t);
}

/** Rebuild a glTF MeshStandardMaterial as MeshPhysicalMaterial, keeping its
 *  texture set, so we can use clearcoat/sheen for a premium finish. */
function toPhysical(
  src: THREE.MeshStandardMaterial,
  props: Partial<THREE.MeshPhysicalMaterial>,
): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial();
  m.name = src.name;
  m.color.copy(src.color);
  m.map = src.map;
  m.normalMap = src.normalMap;
  if (src.normalScale) m.normalScale.copy(src.normalScale);
  m.roughnessMap = src.roughnessMap;
  m.metalnessMap = src.metalnessMap;
  m.aoMap = src.aoMap;
  m.roughness = src.roughness;
  m.metalness = src.metalness;
  m.transparent = src.transparent;
  m.opacity = src.opacity;
  m.alphaTest = src.alphaTest;
  m.side = src.side;
  Object.assign(m, props);
  return m;
}

/**
 * The Blender source used procedural shaders that don't survive glTF export
 * (the 3D-print filament falls back to plain white). Rebuild the finishes to
 * read like a premium product shot: tonal layering between parts, clearcoat
 * micro-sheen on the printed chassis, glossy optics, a faint emitter glow in
 * the LiDAR window.
 */
function gradeMaterial(mat: THREE.MeshStandardMaterial, theme: 'dark' | 'light') {
  const name = mat.name ?? '';
  const dark = theme === 'dark';
  let out: THREE.MeshStandardMaterial = mat;

  // Light/blueprint theme: flat technical-catalogue finish (verified look) —
  // plain standard materials, no clearcoat layer.
  if (!dark) {
    if (name.startsWith('3D Print Filament')) {
      mat.color = new THREE.Color('#1a1b1f');
      mat.roughness = 0.52;
      mat.metalness = 0.05;
    } else if (name === 'Material.023' || name === 'Material.024') {
      mat.color = new THREE.Color('#111114');
      mat.roughness = 0.38;
      mat.metalness = 0.1;
    } else if (name === 'Black scratched plastic') {
      mat.map = null;
      mat.roughnessMap = null;
      mat.metalnessMap = null;
      mat.color = new THREE.Color('#232327');
      mat.roughness = 0.42;
      mat.metalness = 0.15;
    } else if (name === 'Glass dark') {
      const pm = mat as THREE.MeshPhysicalMaterial;
      if ('transmission' in pm) pm.transmission = 0;
      mat.color = new THREE.Color('#0c0c10');
      mat.roughness = 0.08;
      mat.metalness = 0.9;
      mat.transparent = false;
      mat.opacity = 1;
    }
    mat.envMapIntensity = 1.1;
    return mat;
  }

  if (name.startsWith('3D Print Filament')) {
    // Main printed chassis. Graded as dark anodized metal, not raw FDM plastic:
    // deep near-black + low roughness + a real clearcoat so the cool rim lights
    // land as crisp specular streaks — the core "product on black" read.
    out = toPhysical(mat, {
      roughness: 0.4,
      metalness: 0.14,
      clearcoat: 0.55,
      clearcoatRoughness: 0.3,
    });
    out.color = new THREE.Color('#0f1015');
  } else if (name === 'Material.023') {
    // LiDAR puck body — glossy sensor housing
    out = toPhysical(mat, {
      roughness: 0.26,
      metalness: 0.12,
      clearcoat: 0.8,
      clearcoatRoughness: 0.18,
    });
    out.color = new THREE.Color('#0a0b0f');
  } else if (name === 'Material.024') {
    // LiDAR upper cap — piano-black gloss (the real LD19 window band)
    out = toPhysical(mat, {
      roughness: 0.08,
      metalness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    });
    out.color = new THREE.Color('#060609');
  } else if (name === 'Black scratched plastic') {
    // AR0234 housing — crushed-black maps read as a silhouette; satin finish
    out = toPhysical(mat, {
      roughness: 0.34,
      metalness: 0.2,
      clearcoat: 0.55,
      clearcoatRoughness: 0.26,
    });
    out.map = null;
    out.roughnessMap = null;
    out.metalnessMap = null;
    out.color = new THREE.Color('#1e1f24');
  } else if (name === 'Glass dark') {
    // Camera lens element — crisp glossy optic (real transmission renders black
    // over a transparent canvas, so fake it with deep gloss + strong clearcoat).
    out = toPhysical(mat, {
      roughness: 0.03,
      metalness: 0.8,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
    });
    out.color = new THREE.Color('#04040a');
    out.transparent = false;
    out.opacity = 1;
  } else if (name === 'AR3DMat PBR Black Plastic') {
    // rear housing — keep its normal map, add a subtle coat
    out = toPhysical(mat, {
      clearcoat: 0.35,
      clearcoatRoughness: 0.45,
      roughness: 0.46,
    });
    out.color = new THREE.Color('#121318');
  } else if (name === 'Black leather') {
    // Jetson dev-kit shell — textured; keep a satin response
    mat.roughness = Math.min(mat.roughness, 0.58);
  } else if (name === 'Material.025') {
    // IMU board — dark satin
    mat.roughness = 0.5;
    mat.metalness = 0.2;
  }

  // Stronger env reflections carry the studio rim/key on the gloss surfaces.
  out.envMapIntensity = dark ? 1.5 : 1.1;
  return out;
}
