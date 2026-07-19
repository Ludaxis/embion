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
    scene.environmentIntensity = theme === 'dark' ? 1.3 : 1.1;
  }, [scene, theme]);

  return (
    <>
      {theme === 'dark' && floor === 'reflect' && (
        <fog attach="fog" args={['#0a0a0b', 7.5, 15]} />
      )}
      <Environment resolution={512} frames={bakeFrames} background={false}>
        {theme === 'dark' ? (
          <>
            {/* soft top gradient — a slow falloff down the body reads as anodized */}
            <Lightformer
              form="rect"
              color="#fff6ea"
              intensity={2.6}
              position={[0, 6, -0.6]}
              rotation={[-Math.PI / 2, 0, 0]}
              scale={[10, 8, 1]}
            />
            {/* warm key — large soft box, upper front-left */}
            <Lightformer
              form="rect"
              color="#fff2dc"
              intensity={3.6}
              position={[-4.2, 4.2, -3.2]}
              rotation={[-Math.PI / 2.6, -Math.PI / 7, 0]}
              scale={[7, 5, 1]}
            />
            {/* neutral front fill — sensors face -z; keeps front faces off pure black */}
            <Lightformer
              form="rect"
              color="#eef2ff"
              intensity={1.1}
              position={[0, 0.2, -5.4]}
              rotation={[0, Math.PI, 0]}
              scale={[7, 4, 1]}
            />
            {/* COOL RIM LEFT — grazing edge highlight that lifts the silhouette off black */}
            <Lightformer
              form="rect"
              color="#cfe0ff"
              intensity={6}
              position={[-4.7, 2.2, 3.1]}
              rotation={[0, -Math.PI * 0.7, 0]}
              scale={[0.6, 5, 1]}
            />
            {/* COOL RIM RIGHT — the brighter of the pair, defines the hero edge */}
            <Lightformer
              form="rect"
              color="#dbe8ff"
              intensity={7.5}
              position={[4.7, 2.0, 2.9]}
              rotation={[0, Math.PI * 0.7, 0]}
              scale={[0.6, 5.2, 1]}
            />
            {/* long cool streak — a moving grazing highlight across the gloss */}
            <Lightformer
              form="rect"
              color="#e6eeff"
              intensity={3.2}
              position={[-5, 1.2, -0.4]}
              rotation={[0, Math.PI / 2, 0]}
              scale={[7, 0.5, 1]}
            />
            {/* cool ring rim behind — a soft halo on the top LiDAR puck */}
            <Lightformer
              form="ring"
              color="#cfe0ff"
              intensity={2.4}
              position={[1.2, 2.6, 4]}
              rotation={[0, Math.PI, 0]}
              scale={[3.4, 3.4, 1]}
            />
            {/* rear fill so back-facing chapters aren't pure silhouettes */}
            <Lightformer
              form="rect"
              color="#eef1ff"
              intensity={1.4}
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
            blur={[300, 110]}
            resolution={1024}
            mixBlur={1}
            mixStrength={16}
            roughness={0.9}
            depthScale={1}
            minDepthThreshold={0.35}
            maxDepthThreshold={1.4}
            color="#050506"
            metalness={0.5}
            mirror={0.62}
          />
        </mesh>
      )}

      <ContactShadows
        frames={bakeFrames}
        position={[0, theme === 'dark' ? -1.115 : -1.12, 0]}
        opacity={theme === 'dark' ? 0.72 : 0.34}
        scale={6.5}
        blur={2.2}
        far={2.2}
        resolution={512}
        color="#000000"
      />
    </>
  );
}
