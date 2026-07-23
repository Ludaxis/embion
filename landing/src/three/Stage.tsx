import { memo, useEffect } from 'react';
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
// memo: drei's ContactShadows/Environment re-bake after EVERY re-render (their
// frame counters live in the component body), so a Scene re-render mid-scroll
// would capture a transient extracted/spun pose as the permanent baked shadow.
// Props are stable after mount; key={ctxGen} still forces a context-restore
// rebake (key beats memo).
export const Stage = memo(function Stage({ theme, floor = 'none', bakeFrames = 1 }: Props) {
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    // The MODEL's materials bind the env map directly (ModuleModel) and carry
    // their own envMapIntensity ladder — this global only reaches unbound
    // materials, i.e. the reflector floor. Keep it low or the floor washes
    // out the composition under AgX.
    scene.environmentIntensity = theme === 'dark' ? 0.4 : 1.1;
  }, [scene, theme]);

  return (
    <>
      {theme === 'dark' && floor === 'reflect' && (
        <fog attach="fog" args={['#0a0a0b', 5.5, 11.5]} />
      )}
      {/* 256 is plenty for low-frequency softboxes and bakes ~4× faster */}
      <Environment resolution={256} frames={bakeFrames} background={false}>
        {theme === 'dark' ? (
          <>
            {/* soft top gradient — a slow falloff down the body reads as anodized */}
            <Lightformer
              form="rect"
              color="#f8f3ea"
              intensity={2.5}
              position={[0, 6, -0.6]}
              rotation={[-Math.PI / 2, 0, 0]}
              scale={[10, 8, 1]}
            />
            {/* warm key — large soft box, upper front-left. Leads the scene so the
                body gets a sculpted key→fill gradient (not just lit edges).
                Bright enough to clearly lead the rims. */}
            <Lightformer
              form="rect"
              color="#f9f1e2"
              intensity={4.4}
              position={[-4.2, 4.2, -3.2]}
              rotation={[-Math.PI / 2.6, -Math.PI / 7, 0]}
              scale={[9, 6, 1]}
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
            {/* COOL RIM LEFT — grazing edge accent that lifts the silhouette off
                black. Kept below the key so it reads as an accent, not the light. */}
            <Lightformer
              form="rect"
              color="#cfe0ff"
              intensity={3.4}
              position={[-4.7, 2.2, 3.1]}
              rotation={[0, -Math.PI * 0.7, 0]}
              scale={[0.6, 5, 1]}
            />
            {/* COOL RIM RIGHT — the brighter of the pair, defines the hero edge */}
            <Lightformer
              form="rect"
              color="#dbe8ff"
              intensity={4.2}
              position={[4.7, 2.0, 2.9]}
              rotation={[0, Math.PI * 0.7, 0]}
              scale={[0.6, 5.2, 1]}
            />
            {/* long cool streak — a moving grazing highlight across the gloss */}
            <Lightformer
              form="rect"
              color="#e6eeff"
              intensity={2.5}
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
          <planeGeometry args={[44, 44]} />
          <MeshReflectorMaterial
            blur={[320, 120]}
            resolution={512}
            mixBlur={1}
            mixStrength={14}
            roughness={1}
            depthScale={1}
            minDepthThreshold={0.35}
            maxDepthThreshold={1.4}
            color="#0a0a0b"
            metalness={0}
            mirror={0.45}
            envMapIntensity={0.12}
          />
        </mesh>
      )}

      <ContactShadows
        // Live on the high tier so the floor shadow tracks the fusion
        // turntable + part extraction instead of freezing in the baked shape;
        // slightly stronger when there is no reflector floor to ground the
        // module on the flat backdrop.
        frames={floor === 'reflect' ? Infinity : bakeFrames}
        position={[0, theme === 'dark' ? -1.115 : -1.12, 0]}
        opacity={theme === 'dark' ? (floor === 'reflect' ? 0.72 : 0.8) : 0.34}
        scale={6.5}
        blur={2.2}
        far={2.2}
        resolution={512}
        color="#000000"
      />
    </>
  );
});
