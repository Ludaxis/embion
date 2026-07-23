import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { motion } from '../lib/motion';
import { partRegistry } from './ModuleModel';

type Props = { accent: string };

const tmp = new THREE.Vector3();

/** Position `ref` at a part's live world anchor each frame, so effects track
 *  extraction / explode / spin automatically. */
function trackPart(name: string, obj: THREE.Object3D | null) {
  if (!obj) return;
  const entry = partRegistry.get(name);
  if (!entry) return;
  tmp.copy(entry.anchorLocal);
  entry.obj.localToWorld(tmp);
  obj.position.copy(tmp);
}

/** HDR accent (values > 1): survives the AgX tonemap as a saturated core and
 *  actually crosses Bloom's threshold on composer tiers. */
function hdr(color: string, k: number) {
  return new THREE.Color(color).multiplyScalar(k);
}

/** Per-chapter accent effects: LiDAR sweep, mic pulse rings, ToF depth grid,
 *  plus two always-on status LEDs (the "powered-on" story). All tiny additive
 *  meshes, opacity damped by motion.focus. */
export function SensorFX({ accent }: Props) {
  return (
    <group>
      <LidarSweep accent={accent} />
      <MicRings accent={accent} />
      <TofGrid accent={accent} />
    </group>
  );
}

/** Damped 0..1 level. `level()` may return fractional targets (idle whisper).
 *  Returns [fade, unsettledRef] so callers can skip work when parked at 0. */
function useFocusFade(level: () => number, lambda = 5) {
  const fade = useRef(0);
  const settled = useRef(false);
  useFrame((state, dt) => {
    const target = level();
    if (Math.abs(fade.current - target) < 1e-3) {
      fade.current = target;
      settled.current = true;
    } else {
      fade.current = THREE.MathUtils.damp(fade.current, target, lambda, dt);
      settled.current = false;
      state.invalidate(); // demand-frameloop: keep settling
    }
  });
  return fade;
}

function LidarSweep({ accent }: { accent: string }) {
  const root = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringMatRef = useRef<THREE.LineBasicMaterial>(null);
  // Sweep ONLY during the LiDAR chapter — at any other beat a faint ring
  // reads as a stray red line slicing the hero, not as design.
  const fade = useFocusFade(() => (motion.focus === 'lidar-ld19' ? 1 : 0));
  const color = useMemo(() => hdr(accent, 2.5), [accent]);

  const sector = useMemo(() => {
    const geo = new THREE.CircleGeometry(1.6, 48, 0, Math.PI / 3.2);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  // Radial alpha falloff: the beam is dense at the emitter and dissolves
  // outward — a flat additive sheet with a razor edge reads as a glitch.
  const falloff = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.42)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
  }, []);

  const ring = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  useFrame((state) => {
    if (!root.current || !spin.current || !matRef.current || !ringMatRef.current) return;
    const visible = fade.current > 0.01;
    root.current.visible = visible;
    if (!visible) return; // parked: skip all tracking/material work
    trackPart('lidar-ld19', root.current);
    spin.current.rotation.y = state.clock.elapsedTime * 1.4;
    matRef.current.opacity = fade.current * 0.11;
    ringMatRef.current.opacity = fade.current * 0.25;
  });

  return (
    <group ref={root}>
      <group ref={spin}>
        <mesh geometry={sector} renderOrder={-1}>
          <meshBasicMaterial
            ref={matRef}
            color={color}
            alphaMap={falloff}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
      <lineLoop geometry={ring} renderOrder={-1}>
        <lineBasicMaterial
          ref={ringMatRef}
          color={color}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </lineLoop>
    </group>
  );
}

const MIC_PARTS: { name: string; rotY: number; out: [number, number, number] }[] = [
  { name: 'mic-a', rotY: -Math.PI / 2, out: [0.09, 0, 0] },
  { name: 'mic-b', rotY: 0, out: [0, 0, -0.09] },
  { name: 'mic-c', rotY: Math.PI / 2, out: [-0.09, 0, 0] },
];

function MicRings({ accent }: { accent: string }) {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const fade = useFocusFade(() => (motion.focus === 'mic-b' ? 1 : 0));
  const color = useMemo(() => hdr(accent, 2.2), [accent]);

  const geo = useMemo(() => new THREE.RingGeometry(0.96, 1.0, 40), []);

  useFrame((state) => {
    const visible = fade.current > 0.01;
    MIC_PARTS.forEach((mic, mi) => {
      const g = groupRefs.current[mi];
      if (g) g.visible = visible;
      if (!visible) return; // parked
      trackPart(mic.name, g);
      if (g) {
        // bounds center sits on the PCB; lift to the capsule port and step
        // just outside the housing so rings never intersect it
        g.position.y += 0.06;
        g.position.x += mic.out[0];
        g.position.z += mic.out[2];
      }
      [0, 1, 2].forEach((ri) => {
        const mesh = meshRefs.current[mi * 3 + ri];
        if (!mesh) return;
        const t = (state.clock.elapsedTime * 0.55 + ri * 0.33) % 1;
        mesh.scale.setScalar(0.07 + t * 0.2);
        (mesh.material as THREE.MeshBasicMaterial).opacity = fade.current * (1 - t) * 0.32;
      });
    });
  });

  return (
    <>
      {MIC_PARTS.map((mic, mi) => (
        <group
          key={mic.name}
          rotation={[0, mic.rotY, 0]}
          ref={(el) => { groupRefs.current[mi] = el; }}
        >
          {[0, 1, 2].map((ri) => (
            <mesh
              key={ri}
              geometry={geo}
              renderOrder={-1}
              ref={(el) => { meshRefs.current[mi * 3 + ri] = el; }}
            >
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0}
                side={THREE.DoubleSide}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function TofGrid({ accent }: { accent: string }) {
  const root = useRef<THREE.Group>(null);
  const ref = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const fade = useFocusFade(() => (motion.focus === 'tof-8x8' ? 1 : 0));
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => hdr(accent, 2.2), [accent]);

  useFrame((state) => {
    if (!root.current || !ref.current || !matRef.current) return;
    const visible = fade.current > 0.01;
    root.current.visible = visible;
    if (!visible) return; // parked: skip the 64-matrix rebuild + GPU upload
    trackPart('tof-8x8', root.current);
    matRef.current.opacity = fade.current * 0.6;
    const t = state.clock.elapsedTime;
    let i = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const wave = Math.sin(t * 2.2 - (x + y) * 0.35) * 0.5 + 0.5;
        dummy.position.set(
          (x - 3.5) * 0.065,
          (y - 3.5) * 0.065,
          -0.14 - wave * 0.14 * fade.current,
        );
        dummy.scale.setScalar(0.0055 + wave * 0.0045);
        dummy.updateMatrix();
        ref.current.setMatrixAt(i++, dummy.matrix);
      }
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={root}>
      <instancedMesh ref={ref} args={[undefined, undefined, 64]} renderOrder={-1}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          ref={matRef}
          color={color}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
