import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei';

type Props = {
  theme: 'dark' | 'light';
  /** reflective stage floor (dark theme hero look). Costs one extra scene render. */
  floor?: 'reflect' | 'none';
  /** frames for env/shadow baking — pages use 1 (bake once); the still-capture
   *  rig passes Infinity so bakes can't race a throttled frame loop. */
  bakeFrames?: number;
};

/**
 * Studio lighting built from Lightformer softboxes; CSS owns the backdrop.
 * Dark: warm key + cool rim/streaks (color contrast reads cinematic on black).
 * Light: bright, even, neutral — technical-catalogue look.
 */
export function Stage({ theme, floor = 'none', bakeFrames = 1 }: Props) {
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    scene.environmentIntensity = theme === 'dark' ? 1.15 : 1.1;
  }, [scene, theme]);

  return (
    <>
      {theme === 'dark' && floor === 'reflect' && (
        <fog attach="fog" args={['#0a0a0b', 7.5, 15]} />
      )}
      <Environment resolution={512} frames={bakeFrames} background={false}>
        {theme === 'dark' ? (
          <>
            {/* warm key — large overhead-left softbox */}
            <Lightformer
              form="rect"
              color="#fff9ef"
              intensity={4.2}
              position={[-3.5, 5, -2.5]}
              rotation={[-Math.PI / 2, 0, Math.PI / 8]}
              scale={[7, 5, 1]}
            />
            {/* long cool streak strips — grazing highlights on gloss */}
            <Lightformer
              form="rect"
              color="#dbe6ff"
              intensity={3.8}
              position={[-5, 1.3, -0.6]}
              rotation={[0, Math.PI / 2, 0]}
              scale={[7, 0.65, 1]}
            />
            <Lightformer
              form="rect"
              color="#e8eeff"
              intensity={2.0}
              position={[5, 2.1, 0.4]}
              rotation={[0, -Math.PI / 2, 0]}
              scale={[6, 0.5, 1]}
            />
            {/* neutral front fill — sensors face -z */}
            <Lightformer
              form="rect"
              color="#ffffff"
              intensity={1.25}
              position={[0, 0.4, -5]}
              rotation={[0, Math.PI, 0]}
              scale={[6, 3, 1]}
            />
            {/* cool ring rim behind */}
            <Lightformer
              form="ring"
              color="#cfe0ff"
              intensity={3}
              position={[1.5, 2.5, 4]}
              rotation={[0, Math.PI, 0]}
              scale={[3.6, 3.6, 1]}
            />
            {/* hard rim strip behind-right — separates edges from the bg */}
            <Lightformer
              form="rect"
              color="#e6edff"
              intensity={4.5}
              position={[4.2, 1.6, 3.2]}
              rotation={[0, -Math.PI * 0.72, 0]}
              scale={[0.55, 4.5, 1]}
            />
            {/* rear fill so back-facing chapters aren't silhouettes */}
            <Lightformer
              form="rect"
              color="#f2f4ff"
              intensity={1.7}
              position={[0, 1, 5]}
              rotation={[0, Math.PI, 0]}
              scale={[6, 3, 1]}
            />
          </>
        ) : (
          <>
            <Lightformer
              form="rect"
              color="#fffdf8"
              intensity={4}
              position={[0, 5, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              scale={[9, 6, 1]}
            />
            <Lightformer
              form="rect"
              intensity={2.2}
              position={[0, 0.5, -5]}
              rotation={[0, Math.PI, 0]}
              scale={[6, 3, 1]}
            />
            <Lightformer
              form="rect"
              intensity={1.8}
              position={[-5, 1, 0]}
              rotation={[0, Math.PI / 2, 0]}
              scale={[4, 1.4, 1]}
            />
            <Lightformer
              form="rect"
              intensity={1.8}
              position={[5, 1.5, 1]}
              rotation={[0, -Math.PI / 2, 0]}
              scale={[4, 1.2, 1]}
            />
          </>
        )}
      </Environment>

      {theme === 'dark' ? (
        <directionalLight position={[-2.5, 4, -3]} intensity={0.45} color="#fff4e6" />
      ) : (
        <>
          {/* keep matte-black parts readable on paper white */}
          <ambientLight intensity={0.3} />
          <directionalLight position={[-3, 4, -4]} intensity={0.85} />
        </>
      )}

      {floor === 'reflect' && theme === 'dark' && (
        <mesh rotation-x={-Math.PI / 2} position={[0, -1.13, 0]}>
          <planeGeometry args={[18, 18]} />
          <MeshReflectorMaterial
            blur={[380, 90]}
            resolution={1024}
            mixBlur={1}
            mixStrength={22}
            roughness={0.92}
            depthScale={1.1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#040405"
            metalness={0.45}
            mirror={0.55}
          />
        </mesh>
      )}

      <ContactShadows
        frames={bakeFrames}
        position={[0, theme === 'dark' ? -1.115 : -1.12, 0]}
        opacity={theme === 'dark' ? 0.55 : 0.34}
        scale={7}
        blur={2.6}
        far={2.4}
        resolution={512}
        color="#000000"
      />
    </>
  );
}
