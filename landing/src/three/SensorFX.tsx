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

/** Per-chapter accent effects: LiDAR sweep, mic pulse rings, ToF depth grid.
 *  All tiny additive meshes, opacity damped by motion.focus. */
export function SensorFX({ accent }: Props) {
  return (
    <group>
      <LidarSweep accent={accent} />
      <MicRings accent={accent} />
      <TofGrid accent={accent} />
    </group>
  );
}

function useFocusFade(active: () => boolean, lambda = 5) {
  const fade = useRef(0);
  useFrame((_, dt) => {
    fade.current = THREE.MathUtils.damp(fade.current, active() ? 1 : 0, lambda, dt);
  });
  return fade;
}

function LidarSweep({ accent }: { accent: string }) {
  const root = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringMatRef = useRef<THREE.LineBasicMaterial>(null);
  const fade = useFocusFade(() => motion.focus === 'lidar-ld19');

  const sector = useMemo(() => {
    const geo = new THREE.CircleGeometry(1.9, 48, 0, Math.PI / 3.2);
    geo.rotateX(-Math.PI / 2);
    return geo;
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
    trackPart('lidar-ld19', root.current);
    root.current.visible = fade.current > 0.01;
    spin.current.rotation.y = state.clock.elapsedTime * 1.4;
    matRef.current.opacity = fade.current * 0.16;
    ringMatRef.current.opacity = fade.current * 0.35;
  });

  return (
    <group ref={root}>
      <group ref={spin}>
        <mesh geometry={sector}>
          <meshBasicMaterial
            ref={matRef}
            color={accent}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
      <lineLoop geometry={ring}>
        <lineBasicMaterial
          ref={ringMatRef}
          color={accent}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </lineLoop>
    </group>
  );
}

const MIC_PARTS: { name: string; rotY: number }[] = [
  { name: 'mic-a', rotY: -Math.PI / 2 },
  { name: 'mic-b', rotY: 0 },
  { name: 'mic-c', rotY: Math.PI / 2 },
];

function MicRings({ accent }: { accent: string }) {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const fade = useFocusFade(() => motion.focus === 'mic-b');

  const geo = useMemo(() => new THREE.RingGeometry(0.96, 1.0, 40), []);

  useFrame((state) => {
    MIC_PARTS.forEach((mic, mi) => {
      trackPart(mic.name, groupRefs.current[mi]);
      [0, 1, 2].forEach((ri) => {
        const mesh = meshRefs.current[mi * 3 + ri];
        if (!mesh) return;
        const t = (state.clock.elapsedTime * 0.55 + ri * 0.33) % 1;
        mesh.visible = fade.current > 0.01;
        mesh.scale.setScalar(0.12 + t * 0.55);
        (mesh.material as THREE.MeshBasicMaterial).opacity = fade.current * (1 - t) * 0.5;
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
              ref={(el) => { meshRefs.current[mi * 3 + ri] = el; }}
            >
              <meshBasicMaterial
                color={accent}
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
  const fade = useFocusFade(() => motion.focus === 'tof-8x8');
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!root.current || !ref.current || !matRef.current) return;
    trackPart('tof-8x8', root.current);
    root.current.visible = fade.current > 0.01;
    matRef.current.opacity = fade.current * 0.85;
    const t = state.clock.elapsedTime;
    let i = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const wave = Math.sin(t * 2.2 - (x + y) * 0.35) * 0.5 + 0.5;
        dummy.position.set(
          (x - 3.5) * 0.075,
          (y - 3.5) * 0.075,
          -0.24 - wave * 0.28 * fade.current,
        );
        dummy.scale.setScalar(0.011 + wave * 0.011);
        dummy.updateMatrix();
        ref.current.setMatrixAt(i++, dummy.matrix);
      }
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={root}>
      <instancedMesh ref={ref} args={[undefined, undefined, 64]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          ref={matRef}
          color={accent}
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
