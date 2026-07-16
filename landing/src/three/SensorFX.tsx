import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { motion } from '../lib/motion';

const LIDAR_POS: [number, number, number] = [0.03, 0.685, -0.72];
const MIC_POSITIONS: [number, number, number][] = [
  [1.04, 0.07, -0.39],
  [0.0, 0.03, -0.77],
  [-1.04, 0.04, -0.39],
];
const TOF_POS: [number, number, number] = [-0.02, -0.79, -0.79];

type Props = { accent: string };

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
  const group = useRef<THREE.Group>(null);
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
    if (!group.current || !matRef.current || !ringMatRef.current) return;
    group.current.visible = fade.current > 0.01;
    group.current.rotation.y = state.clock.elapsedTime * 1.4;
    matRef.current.opacity = fade.current * 0.16;
    ringMatRef.current.opacity = fade.current * 0.35;
  });

  return (
    <group position={LIDAR_POS}>
      <group ref={group}>
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

function MicRings({ accent }: { accent: string }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const fade = useFocusFade(() => motion.focus === 'mic-b');

  const geo = useMemo(() => {
    const g = new THREE.RingGeometry(0.96, 1.0, 40);
    return g;
  }, []);

  useFrame((state) => {
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const t = (state.clock.elapsedTime * 0.55 + i * 0.33) % 1;
      const scale = 0.12 + t * 0.55;
      mesh.visible = fade.current > 0.01;
      mesh.scale.setScalar(scale);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = fade.current * (1 - t) * 0.5;
    });
  });

  return (
    <>
      {MIC_POSITIONS.map((pos, mi) =>
        [0, 1, 2].map((ri) => (
          <mesh
            key={`${mi}-${ri}`}
            geometry={geo}
            position={pos}
            rotation={[0, mi === 0 ? -Math.PI / 2 : mi === 2 ? Math.PI / 2 : 0, 0]}
            ref={(el) => {
              refs.current[mi * 3 + ri] = el;
            }}
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
        )),
      )}
    </>
  );
}

function TofGrid({ accent }: { accent: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const fade = useFocusFade(() => motion.focus === 'tof-8x8');
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!ref.current || !matRef.current) return;
    ref.current.visible = fade.current > 0.01;
    matRef.current.opacity = fade.current * 0.85;
    const t = state.clock.elapsedTime;
    let i = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const wave = Math.sin(t * 2.2 - (x + y) * 0.35) * 0.5 + 0.5;
        dummy.position.set(
          TOF_POS[0] + (x - 3.5) * 0.075,
          TOF_POS[1] + (y - 3.5) * 0.075,
          TOF_POS[2] - 0.24 - wave * 0.28 * fade.current,
        );
        const s = 0.011 + wave * 0.011;
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        ref.current.setMatrixAt(i++, dummy.matrix);
      }
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
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
  );
}
