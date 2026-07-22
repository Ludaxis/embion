import { EffectComposer, Bloom, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Dark-studio post stack. Lazy-imported so postprocessing + n8ao land in their
 * own chunk that low-end devices (composer disabled) never download.
 *
 * The ToneMapping effect is NOT optional: mounting EffectComposer sets the
 * renderer to NoToneMapping, so without it composer tiers render raw linear
 * output with clipped speculars while the low tier gets AgX — two different
 * color grades per GPU tier. AGX here reads renderer.toneMappingExposure
 * (1.26) automatically. Order matters: bloom samples HDR pre-tonemap.
 * The vignette lives in CSS (see styles) — on a transparent canvas a post
 * vignette can only darken the product itself, not the frame edges.
 */
export default function Composer({ ao }: { ao: boolean }) {
  return ao ? (
    <EffectComposer multisampling={0}>
      <N8AO halfRes aoRadius={0.5} intensity={3.8} distanceFalloff={0.5} />
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.3} intensity={0.5} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <SMAA />
    </EffectComposer>
  ) : (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.3} intensity={0.5} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <SMAA />
    </EffectComposer>
  );
}
