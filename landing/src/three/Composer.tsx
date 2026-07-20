import { EffectComposer, Bloom, Vignette, N8AO, SMAA } from '@react-three/postprocessing';

/**
 * Dark-studio post stack. Lazy-imported so postprocessing + n8ao land in their
 * own chunk that low-end devices (composer disabled) never download.
 */
export default function Composer({ ao }: { ao: boolean }) {
  return ao ? (
    <EffectComposer multisampling={0}>
      <N8AO halfRes aoRadius={0.5} intensity={3.8} distanceFalloff={0.5} />
      <Bloom mipmapBlur luminanceThreshold={0.9} intensity={0.62} />
      <Vignette darkness={0.55} offset={0.22} />
      <SMAA />
    </EffectComposer>
  ) : (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur luminanceThreshold={0.9} intensity={0.62} />
      <Vignette darkness={0.55} offset={0.22} />
      <SMAA />
    </EffectComposer>
  );
}
