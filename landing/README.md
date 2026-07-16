# EMBION EMB-01 — Landing Pages

Two production landing pages (Noir + Explorer) for the EMB-01 multimodal perception module, sharing one
optimized 3D model and one copy source.

| Route | Version | Art direction |
|---|---|---|
| `/` | **01 · Noir** | Dark cinematic, Apple-style scroll storytelling. Scroll-scrubbed camera flight through 7 sensor chapters with part extraction, per-chapter accent effects (LiDAR sweep, mic pulse rings, ToF depth grid), fusion turntable finale. |
| `/v3/` | **02 · Explorer** | Dark interactive annotated diagram. Every component labeled with hairline leader lines; hover highlights, click extracts the part from the assembly while the camera flies to it and a glass description card opens (single viewport, no scroll). |
| `/render/` | Render rig | Internal tool for high-res product stills (see below). |

(The former 02 "Blueprint" light exploded-view version was removed; `/v2/` redirects to `/v3/`.)

## Commands

```bash
pnpm install
pnpm dev        # dev server
pnpm build      # production build -> dist/
pnpm preview    # serve dist/
```

## Architecture

- **Stack**: Vite (multi-page) + React 19 + react-three-fiber v9 + drei + GSAP ScrollTrigger + Lenis.
- **One scroll owner**: Lenis rides native scroll → feeds `ScrollTrigger.update()` → one GSAP
  ticker is the single RAF owner (`src/lib/scroll.ts`).
- **GSAP ↔ three bridge**: GSAP tweens plain values on the `motion` singleton
  (`src/lib/motion.ts`); `useFrame` applies them. No React state on the scroll path.
- **DOM is truth**: every headline, spec and CTA is real HTML over a `pointer-events:none`
  fixed canvas. JSON-LD Product schema in both heads.
- **Callouts**: part anchor positions (bounds centers, not node origins — several CAD meshes
  ship world-baked geometry) are projected each frame into `screenAnchors`; a DOM SVG layer
  draws the leader lines on the gsap ticker.
- **Reduced motion**: no Lenis, no scrub, all copy visible statically (`html.reduced`).
- **Poster-first LCP**: `public/posters/poster-{dark,light}.webp` render instantly and
  crossfade out when the GLB is ready.

## 3D model pipeline

Source: `../path_planner_module.glb` (152 MB, ~4M tris, Blender export)
→ `public/models/module.glb` (**8.8 MB, ~300k tris**, meshopt-compressed).

```bash
node scripts/optimize-model.mjs public/models/module.glb src/data/anchors.json
# deps: @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer sharp
```

What it does: renames parts to stable slugs (`lidar-ld19`, `imu`, `mic-a/b/c`,
`camera-ar0234`, `tof-8x8`, `jetson`, …), recenters + normalizes scale (height = 2 world
units), drops split normals on CAD meshes → position-weld → per-mesh budgeted meshopt
simplification → recomputed normals, WebP textures @1024, EXT_meshopt_compression, and emits
per-part anchor data.

Materials are re-graded at runtime (`gradeMaterial` in `src/three/ModuleModel.tsx`) because
the Blender procedural shaders don't survive glTF export (the 3D-print filament falls back
to white).

## Render rig (`/render/`)

Produces the marketing stills in `renders/` (4K PNGs) via a small save-server.

```
/render/?shot=hero&theme=dark&w=1920&h=1080&dpr=2            # view a shot
          &capture=1&name=my-shot                             # auto-download a PNG
          &drive=timer                                        # render with rAF frozen (occluded window)
```

Shots: `hero`, `hero-v2`, `three-quarter`, `three-quarter-r`, `front`, `top`, `back`,
`lidar`, `camera`. Add `bg=transparent` for packshot-style transparent captures.

## Copy / content

All product copy, specs, FAQ and CTAs live in `src/content/product.ts` — edit once, both
versions update. Contact + build-log links are at the top of that file.
