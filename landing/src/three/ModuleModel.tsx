import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { motion } from '../lib/motion';
import { PART_NAMES, FOCUS_GROUPS, EXPLODE, EXTRACT_VECTORS } from './parts';

export { PART_NAMES, EXPLODE, EXTRACT_VECTORS } from './parts';

export const MODEL_URL = '/models/module.glb';
export const MODEL_URL_MOBILE = '/models/module-mobile.glb';

/** Pick the light mobile mesh (57k tris / 1.7 MB vs 120k / 3.7 MB) on likely-weak
 *  or touch devices. Synchronous so the preload + first fetch use the right URL.
 *  Same normalization + node names as desktop, so camera presets and part
 *  extraction are identical. */
function pickModelUrl(): string {
  if (typeof matchMedia !== 'function') return MODEL_URL;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = matchMedia('(pointer: coarse)').matches;
  const weak =
    (nav.deviceMemory != null && nav.deviceMemory <= 4) ||
    (nav.hardwareConcurrency != null && nav.hardwareConcurrency <= 4);
  return coarse || weak ? MODEL_URL_MOBILE : MODEL_URL;
}
export const DEFAULT_MODEL_URL = pickModelUrl();
useGLTF.preload(DEFAULT_MODEL_URL);

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

export function ModuleModel({ theme, dimStyle = 'darken', url = DEFAULT_MODEL_URL }: Props) {
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
    materials: {
      mat: THREE.MeshStandardMaterial;
      baseColor: THREE.Color;
      baseEnv: number;
      baseEmissive: number;
    }[];
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
          materials.push({
            mat,
            baseColor: (mat.color ?? new THREE.Color('#ffffff')).clone(),
            baseEnv: mat.envMapIntensity ?? 1,
            baseEmissive: mat.emissiveIntensity ?? 0,
          });
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
      for (const { mat, baseColor, baseEnv, baseEmissive } of p.materials) {
        if (dimStyle === 'fade') {
          mat.opacity = p.dim;
        } else {
          // Dim reflections + emissive, not just albedo: a near-black part is
          // defined by its env reflection, so scaling colour alone barely dims it.
          mat.envMapIntensity = baseEnv * p.dim;
          if (baseEmissive) mat.emissiveIntensity = baseEmissive * p.dim;
          if (mat.color) mat.color.copy(baseColor).multiplyScalar(0.5 + 0.5 * p.dim);
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

  // Dark grade. Subsystems must READ apart on a busy rig, so parts separate by
  //  (a) reflectance CHARACTER — dielectric polymer (matte + clearcoat sheen)
  //      vs true metal (metalness 1, bright specular), not muddy mid-metalness;
  //  (b) a small VALUE spread — graphite chassis a step above the black metals;
  //  (c) one HUE — green PCB soldermask — as the only colour, signalling
  //      "electronics"; and (d) faint EMISSIVE on the optical windows so the
  //  sensors read as active. envMapIntensity carries the studio on the metals.
  let env = 1.6;
  if (name.startsWith('3D Print Filament')) {
    // Hero body — printed polymer as warm graphite, a clear value step above the
    // black metal parts. Dielectric (metalness 0) with a clearcoat micro-sheen.
    out = toPhysical(mat, {
      roughness: 0.46,
      metalness: 0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.32,
    });
    out.color = new THREE.Color('#191b21');
  } else if (name === 'Material.023') {
    // LiDAR puck body — turned/anodised gunmetal: TRUE metal but rough enough to
    // scatter the studio into a soft brushed sheen, not a hot chrome mirror.
    out = toPhysical(mat, {
      roughness: 0.52,
      metalness: 1,
      clearcoat: 0.25,
      clearcoatRoughness: 0.4,
      anisotropy: 0.45,
    });
    out.color = new THREE.Color('#16181e');
  } else if (name === 'Material.024') {
    // LiDAR cap window — piano-black metal + a faint IR-emitter glow.
    out = toPhysical(mat, {
      roughness: 0.1,
      metalness: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    });
    out.color = new THREE.Color('#0a0a0e');
    out.emissive = new THREE.Color('#2a0800');
    out.emissiveIntensity = 0.35;
  } else if (name === 'Black scratched plastic') {
    // AR0234 housing — matte dark polymer; keep the roughness/normal breakup,
    // only drop the crushed diffuse (it read as a flat silhouette).
    out = toPhysical(mat, {
      roughness: 0.46,
      metalness: 0,
      clearcoat: 0.3,
      clearcoatRoughness: 0.34,
    });
    out.map = null;
    out.color = new THREE.Color('#26272e');
  } else if (name === 'Glass dark') {
    // Camera lens — a DIELECTRIC optic, not black chrome: metalness 0 so Fresnel
    // + a strong env reflection define the glass, plus a whisper of emissive
    // sheen. (Real transmission renders black over the transparent canvas.)
    out = toPhysical(mat, {
      roughness: 0.05,
      metalness: 0,
      ior: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
    });
    out.color = new THREE.Color('#050609');
    out.emissive = new THREE.Color('#001420');
    out.emissiveIntensity = 0.16;
    out.transparent = false;
    out.opacity = 1;
    env = 2.6; // reflections carry the optic
  } else if (name === 'AR3DMat PBR Black Plastic') {
    // Rear housing — dielectric polymer; keep its normal map.
    out = toPhysical(mat, {
      metalness: 0,
      clearcoat: 0.3,
      clearcoatRoughness: 0.45,
      roughness: 0.5,
    });
    out.color = new THREE.Color('#191a20');
  } else if (name === 'Black leather') {
    // Jetson shell — 'leather' is a placeholder; read it honestly as a brushed
    // aluminium heat-spreader (true metal) rather than fabric.
    out = toPhysical(mat, { roughness: 0.5, metalness: 0.9, clearcoat: 0 });
    out.map = null;
    out.normalMap = null;
    out.roughnessMap = null;
    out.color = new THREE.Color('#24272f');
  } else if (name === 'Material.025') {
    // IMU board — the ONE hue: green PCB soldermask, so "electronics" reads.
    out = toPhysical(mat, { roughness: 0.45, metalness: 0.1, clearcoat: 0.3 });
    out.color = new THREE.Color('#0f2417');
  }

  out.envMapIntensity = dark ? env : 1.1;
  return out;
}
