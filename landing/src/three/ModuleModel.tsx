import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { motion } from '../lib/motion';
import { pickModelUrl } from '../lib/pickModel';
import { PART_NAMES, FOCUS_GROUPS, EXPLODE, EXTRACT_VECTORS } from './parts';

export { PART_NAMES, EXPLODE, EXTRACT_VECTORS } from './parts';
export { MODEL_URL, MODEL_URL_MOBILE } from '../lib/pickModel';

// Accelerated raycasts (v3 hover/click picking against ~300k tris). The
// prototype patch is global but inert until a geometry gets a boundsTree —
// meshes without one fall back to three's stock raycast. (three-mesh-bvh's
// type augmentation declares these members on three's own interfaces.)
THREE.BufferGeometry.prototype.computeBoundsTree =
  computeBoundsTree as unknown as typeof THREE.BufferGeometry.prototype.computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export const DEFAULT_MODEL_URL = pickModelUrl();
// Fallback kick for entries without the HTML-level preload (dev, render rig);
// on the real pages this resolves instantly from the head <link rel=preload>.
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
  /** build BVH acceleration for pointer picking (v3) */
  bvhRaycast?: boolean;
};

export function ModuleModel({
  theme,
  dimStyle = 'darken',
  url = DEFAULT_MODEL_URL,
  bvhRaycast = false,
}: Props) {
  const { scene } = useGLTF(url);
  const rootRef = useRef<THREE.Group>(null);

  // Clone the scene graph + materials once per mount so theme/dim mutations
  // never leak through the global useGLTF cache (shared across pages).
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    // The v3 hybrid ships the new export's ROUGH camera assembly co-located
    // with the grafted finished camera — showing both z-fights in the camera
    // bay. The finished part (camera-ar0234, real lens) wins.
    const rough = c.getObjectByName('frame-detail');
    if (rough) rough.visible = false;
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

  // BVH build is deferred off the mount path; geometries are shared with the
  // useGLTF cache so the tree is built once per asset, never disposed here.
  useEffect(() => {
    if (!bvhRaycast) return;
    let cancelled = false;
    const build = () => {
      if (cancelled) return;
      cloned.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (!mesh.geometry.boundsTree) mesh.geometry.computeBoundsTree();
      });
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    const id = idle ? idle(build) : window.setTimeout(build, 300);
    return () => {
      cancelled = true;
      if (!idle) clearTimeout(id as number);
    };
  }, [cloned, bvhRaycast]);

  type PartState = {
    obj: THREE.Object3D;
    basePos: THREE.Vector3;
    baseRotZ: number;
    explodeLocal: THREE.Vector3;
    extractLocal: THREE.Vector3;
    materials: {
      mat: THREE.MeshStandardMaterial;
      baseColor: THREE.Color;
      baseEnv: number;
      baseEmissive: number;
      /** the LiDAR window breathes (idle "powered-on" pulse) */
      pulse: boolean;
    }[];
    dim: number; // damped 0..1 (1 = fully present)
    settled: boolean; // dim reached target → skip material writes
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
            pulse: (mat.emissiveIntensity ?? 0) >= 0.3,
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
        baseRotZ: obj.rotation.z,
        explodeLocal: new THREE.Vector3(ex[0], ex[1], ex[2]).divideScalar(rootScale),
        extractLocal: new THREE.Vector3(exv[0], exv[1], exv[2]).divideScalar(rootScale),
        materials,
        dim: 1,
        settled: false,
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
  const boundEnv = useRef<THREE.Texture | null>(null);
  const prevPose = useRef({ explode: NaN, extract: NaN, name: '' });

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;

    // three r176 gotcha: material.envMapIntensity only uploads when
    // material.envMap is SET — materials lit purely via scene.environment get
    // the flat scene.environmentIntensity instead, making the whole env
    // ladder, focus dimming's env component, and the hover lift dead writes.
    // Bind the baked environment once it exists (same resolved texture → same
    // program, no recompile). Runs in useFrame because drei <Environment>
    // populates scene.environment only after its first baked frame.
    const env = state.scene.environment;
    if (env !== boundEnv.current) {
      boundEnv.current = env;
      cloned.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const sm = m as THREE.MeshStandardMaterial;
          if (sm.isMeshStandardMaterial) sm.envMap = env;
        }
      });
      state.invalidate();
    }
    // Spin around the cloned scene root — its origin is the world origin.
    // (product-root carries the centering translation, so rotating IT would
    // swing the model on a 12-unit arm.) The tiny sin terms are idle life:
    // the module should never read as a still image (gated off for
    // reduced-motion via motion.idle = 0).
    const idle = motion.idle;
    cloned.rotation.y = motion.spin + motion.spinDrag + Math.sin(t * 0.22) * 0.014 * idle;
    cloned.position.y = Math.sin(t * 0.4) * 0.006 * idle;

    const focusSet = motion.focus ? FOCUS_GROUPS[motion.focus] ?? [motion.focus] : null;
    const hoverSet = motion.hoverName
      ? FOCUS_GROUPS[motion.hoverName] ?? [motion.hoverName]
      : null;

    const extractSet =
      motion.extractName && motion.extractName !== 'chassis-upper'
        ? FOCUS_GROUPS[motion.extractName] ?? [motion.extractName]
        : null;

    // `moving` is a per-frame DELTA, not a level: a held extraction (v3 keeps
    // extract=1 for minutes) must not re-invalidate every frame, and an
    // instant 0-duration reset (reduced motion) must still get its one
    // seat-back write even when every dim is already settled.
    const pp = prevPose.current;
    const moving =
      motion.explode !== pp.explode ||
      motion.extract !== pp.extract ||
      motion.extractName !== pp.name;
    pp.explode = motion.explode;
    pp.extract = motion.extract;
    pp.name = motion.extractName;
    let unsettled = false;

    for (const [name, p] of parts) {
      // global exploded view + single-part extraction. Explode keeps the
      // smoothstep shaping (it is scrubbed linearly by scroll); extraction is
      // applied RAW — GSAP owns its curve, and stacking smoothstep on top of
      // power-out easing made arrivals die into an imperceptible creep.
      if (moving || !p.settled) {
        p.obj.position
          .copy(p.basePos)
          .addScaledVector(p.explodeLocal, easeInOut(motion.explode));
        p.obj.rotation.z = p.baseRotZ;
        if (extractSet && extractSet.includes(name)) {
          p.obj.position.addScaledVector(p.extractLocal, motion.extract);
          // a whisper of secondary motion: parts ride rails, arriving level
          p.obj.rotation.z = p.baseRotZ + Math.sin(motion.extract * Math.PI) * 0.02;
        }
      }

      // focus dimming + hover lift (hover reads as a specular wake-up)
      const hovered = hoverSet?.includes(name) ?? false;
      const focusTarget = !focusSet || focusSet.includes(name) ? 1 : dimTarget;
      const target = hovered ? Math.max(focusTarget, 1.12) : focusTarget;

      if (Math.abs(p.dim - target) < 1e-3) {
        if (!p.settled) {
          p.dim = target;
          writeDim(p, dimStyle);
          p.settled = true;
        }
      } else {
        p.dim = THREE.MathUtils.damp(p.dim, target, hovered ? 9 : 6, dt);
        writeDim(p, dimStyle);
        p.settled = false;
        unsettled = true;
      }

      // powered-on breathing on the LiDAR IR window (cheap: 1 material)
      if (idle > 0) {
        for (const m of p.materials) {
          if (m.pulse) {
            m.mat.emissiveIntensity =
              m.baseEmissive * p.dim * (1 + 0.28 * Math.sin(t * 1.3)) * idle;
          }
        }
      }
    }

    // Demand-frameloop support: keep frames coming while damps settle or a
    // move is in flight. (No-op when frameloop is 'always'.)
    if (unsettled || moving) state.invalidate();
  });

  return <primitive ref={rootRef} object={cloned} />;
}

function writeDim(
  p: {
    dim: number;
    materials: {
      mat: THREE.MeshStandardMaterial;
      baseColor: THREE.Color;
      baseEnv: number;
      baseEmissive: number;
    }[];
  },
  dimStyle: 'darken' | 'fade',
) {
  for (const { mat, baseColor, baseEnv, baseEmissive } of p.materials) {
    if (dimStyle === 'fade') {
      mat.opacity = Math.min(1, p.dim);
    } else {
      // Dim reflections + emissive, not just albedo: a near-black part is
      // defined by its env reflection, so scaling colour alone barely dims it.
      mat.envMapIntensity = baseEnv * p.dim;
      if (baseEmissive) mat.emissiveIntensity = baseEmissive * p.dim;
      if (mat.color) mat.color.copy(baseColor).multiplyScalar(0.5 + 0.5 * Math.min(p.dim, 1));
    }
  }
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
 * read like a premium product shot. Dark-grade principles:
 *  (a) reflectance CHARACTER separates parts — dielectric polymer (matte +
 *      clearcoat sheen) vs true metal, never muddy mid-metalness;
 *  (b) a real VALUE ladder — graphite chassis on top, rear shells a step
 *      below, black metals at the bottom;
 *  (c) ONE hue — green PCB soldermask — signalling "electronics";
 *  (d) visible EMISSIVE on the optical windows so the module reads powered-on.
 * NOTE: these values are tuned against the AgX tonemap (see Composer.tsx —
 * the ToneMapping effect keeps AgX active on composer tiers).
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

  // Baseline env energy ~1.0: envMapIntensity is LIVE now (materials bind
  // the baked environment), so values here are absolute, not aspirational.
  let env = 1.0;
  if (name.startsWith('3D Print Filament') || name.startsWith('Rough Plastic')) {
    // Hero body — printed polymer as warm graphite, the brightest large
    // surface on the value ladder. Dielectric with a clearcoat micro-sheen.
    out = toPhysical(mat, {
      roughness: 0.48,
      metalness: 0,
      clearcoat: 0.42,
      clearcoatRoughness: 0.26,
    });
    out.color = new THREE.Color('#191c23');
  } else if (name === 'Material.023') {
    // LiDAR puck body — turned/anodised gunmetal: TRUE metal, rough enough to
    // scatter the studio into a soft brushed sheen. Reflection energy (env 2.0)
    // carries it above the chassis in highlight, below in shadow.
    // (No anisotropy: the mesh has no UVs, so the tangent frame is degenerate —
    // the long streak Lightformer paints the brushed highlight instead.)
    out = toPhysical(mat, {
      roughness: 0.45,
      metalness: 1,
      clearcoat: 0.3,
      clearcoatRoughness: 0.35,
    });
    out.color = new THREE.Color('#241f1b'); // burnished warm gunmetal
    env = 1.6;
  } else if (name === 'Material.024') {
    // LiDAR cap window — piano-black metal + a FELT IR-emitter glow (breathes
    // at idle, see ModuleModel useFrame; feeds Bloom on composer tiers).
    out = toPhysical(mat, {
      roughness: 0.1,
      metalness: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    });
    out.color = new THREE.Color('#0d0908');
    out.emissive = new THREE.Color('#3d1000'); // amber IR window
    out.emissiveIntensity = 0.38;
    env = 1.3;
  } else if (name === 'Black scratched plastic') {
    // AR0234 housing — matte dark polymer, lifted a step so the small part
    // reads against the chassis.
    out = toPhysical(mat, {
      roughness: 0.46,
      metalness: 0,
      clearcoat: 0.3,
      clearcoatRoughness: 0.34,
    });
    out.map = null;
    out.color = new THREE.Color('#2b2d35');
  } else if (name === 'Glass dark') {
    // Camera lens — a DIELECTRIC optic, not black chrome: metalness 0 so
    // Fresnel + a strong env reflection define the glass, plus a whisper of
    // emissive sheen. (Real transmission renders black over the transparent
    // canvas.)
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
    env = 2.0; // reflections carry the optic
  } else if (name === 'AR3DMat PBR Black Plastic') {
    // Rear housing — dielectric polymer, a clear step DARKER than the chassis
    // so the rear shell reads as a layer behind it.
    out = toPhysical(mat, {
      metalness: 0,
      clearcoat: 0.3,
      clearcoatRoughness: 0.45,
      roughness: 0.5,
    });
    out.color = new THREE.Color('#14151a');
  } else if (name === 'Black leather') {
    // Jetson shell — 'leather' is a placeholder; read it honestly as a brushed
    // aluminium heat-spreader. Albedo up + env 2.0: the metal read comes from
    // reflection energy, not paint.
    out = toPhysical(mat, { roughness: 0.5, metalness: 0.9, clearcoat: 0 });
    out.map = null;
    out.normalMap = null;
    out.roughnessMap = null;
    out.color = new THREE.Color('#292d36');
    env = 1.5;
  } else if (name === 'Material.025') {
    // IMU board — the ONE hue: green PCB soldermask, bright enough to survive
    // AgX desaturation as an actual green.
    out = toPhysical(mat, { roughness: 0.42, metalness: 0.1, clearcoat: 0.35 });
    out.color = new THREE.Color('#1a4229'); // live green soldermask
  } else if (name === 'mic') {
    // The source texture is a retailer product-listing photo (purple PCB,
    // marketing banner + logo). Kill it: the mic boards join the PCB-green
    // family; the capsule reads via geometry.
    out = toPhysical(mat, {
      roughness: 0.38,
      metalness: 0.85,
      clearcoat: 0.2,
      clearcoatRoughness: 0.3,
    });
    out.map = null;
    out.color = new THREE.Color('#2e2416'); // dark brass — audio hardware cue
    env = 1.5;
  } else if (name === 'tof-board') {
    // DFRobot marketing shot — keep the PCB component detail but seat it hard:
    // multiply the photo down so gold pads stop glowing and the silkscreen
    // branding recedes to invisibility.
    out = toPhysical(mat, { roughness: 0.5, metalness: 0.05, clearcoat: 0.2 });
    out.color = new THREE.Color('#8f939b');
    env = 0.9;
  } else if (name.startsWith('Brushed Steel Procedural')) {
    // v3 bolts — machined steel: true metal, brushed roughness.
    out = toPhysical(mat, { roughness: 0.35, metalness: 1 });
    out.color = new THREE.Color('#3a3d44');
    env = 1.4;
  } else if (name === 'Material.022') {
    // v3 standoffs — turned aluminium spacers.
    out = toPhysical(mat, { roughness: 0.45, metalness: 0.9 });
    out.color = new THREE.Color('#2c2f36');
    env = 1.4;
  } else if (name === 'Material.012' || name === 'Material.018') {
    // v3 ToF carrier plate — one of the pair carries a retailer board photo:
    // seat it like tof-board; the untextured one reads as dark polymer.
    if (mat.map) {
      out = toPhysical(mat, { roughness: 0.5, metalness: 0.05, clearcoat: 0.2 });
      out.color = new THREE.Color('#8f939b');
      env = 0.9;
    } else {
      out = toPhysical(mat, {
        roughness: 0.48,
        metalness: 0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.35,
      });
      out.color = new THREE.Color('#1a1c22');
    }
  } else if (name.startsWith('BE1F1F1F')) {
    // v4 camera lens barrel (translucent in the source) — treat as a real
    // optic: dielectric, high-gloss, faint blue-ish sheen; opaque over the
    // transparent canvas (true transmission renders black there).
    out = toPhysical(mat, {
      roughness: 0.06,
      metalness: 0,
      ior: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
    });
    out.color = new THREE.Color('#0a0d12');
    out.emissive = new THREE.Color('#001420');
    out.emissiveIntensity = 0.14;
    out.transparent = false;
    out.opacity = 1;
    env = 2.0;
  } else if (name.startsWith('FF398E00')) {
    // v4 camera PCB — joins the site's one electronics hue (soldermask green).
    out = toPhysical(mat, { roughness: 0.42, metalness: 0.1, clearcoat: 0.35 });
    out.color = new THREE.Color('#1a4229'); // live green soldermask
  } else if (name.startsWith('x1')) {
    // v4 camera body neutral — seat the bright CAD grey into the dark grade.
    out = toPhysical(mat, { roughness: 0.45, metalness: 0.1, clearcoat: 0.2 });
    out.color = new THREE.Color('#565b64');
  } else if (/^(FF|BE|66)[0-9A-F]{6}(\.\d+)?$/.test(name)) {
    // Exposed-PCB + camera components (hex-named CAD colors: connectors,
    // caps, headers, silkscreen…). Keep their identity but seat them into the
    // grade: tamed albedo, matte dielectric finish. Near-white parts get
    // pulled down harder so they don't glare on the dark stage.
    out = toPhysical(mat, { roughness: 0.45, metalness: 0.05, clearcoat: 0.15 });
    const c = mat.color.clone();
    const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    out.color = c.multiplyScalar(lum > 0.6 ? 0.62 : 0.8);
  }

  out.envMapIntensity = dark ? env : 1.1;
  return out;
}
