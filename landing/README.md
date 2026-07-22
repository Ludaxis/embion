# EMBION EMB-01 — Landing Pages

Two production landing pages (Noir + Explorer) for the EMB-01 multimodal perception module, sharing one
optimized 3D model and one copy source.

| Route | Version | Art direction |
|---|---|---|
| `/` | **01 · Noir** | Dark cinematic, Apple-style scroll storytelling. Scroll-scrubbed camera flight through 7 sensor chapters with part extraction, per-chapter accent effects (LiDAR sweep, mic pulse rings, ToF depth grid), fusion turntable finale. |
| `/v3/` | **02 · Explorer** | Dark interactive annotated diagram. Every component labeled with hairline leader lines; hover highlights, click extracts the part from the assembly while the camera flies to it and a glass description card opens (single viewport, no scroll). |
| `/developers/` `/research/` `/lerobot/` `/datasets/` `/devkit/` `/story/` | Sub-pages | Static pages sharing the Noir design system (`src/site/`): docs-first developer page, research + Founding Labs, LeRobot community page, datasets, dev-kit reservation, and the company story. |
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

Source: `../path_planner_module.glb` (152 MB, ~1.65M tris, Blender export)
→ `public/models/module-v2.glb` (**3.0 MB, ~298k tris**, desktop) and
`public/models/module-mobile-v2.glb` (**1.2 MB, ~129k tris**, coarse-pointer /
low-spec devices — picked by `src/lib/pickModel.ts` and the inline preload
script in each page's `index.html`).

```bash
node scripts/optimize-model.mjs   # emits both variants + src/data/anchors.json
# deps: @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer sharp
```

What it does: renames parts to stable slugs (`lidar-ld19`, `imu`, `mic-a/b/c`,
`camera-ar0234`, `tof-8x8`, `jetson`, …), recenters + normalizes scale (height = 2 world
units), strips textures the dark runtime grade discards, then for over-budget meshes only:
drops split normals → position-weld → budgeted meshopt simplification → crease-angle (40°)
normal reconstruction (hard edges stay hard, turned surfaces stay smooth, index buffers
kept). Under-budget meshes ship untouched with authored normals. WebP textures,
EXT_meshopt_compression level `high`, per-part anchor data, and end-of-build tri/size
assertions.

The filenames are **versioned** (`-v2`) because `/models/*` is served with a 1-year
immutable cache header — bump the version on every regeneration or returning visitors
keep the old geometry.

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

## Prerendering / SEO

`pnpm build` runs `vite build` then `scripts/prerender.mjs`, which renders every page's
React tree to static HTML (`src/ssg/entry-server.tsx`) and injects it into the built
`dist/**/index.html`. Every page — including the two 3D experiences — serves its full copy
without JavaScript; the client entries hydrate the same tree on load. Each page carries its
own meta/OG tags in its HTML shell; `public/robots.txt` + `public/sitemap.xml` cover the
crawler plumbing. The 3D `<Scene>` mounts client-side only, so the prerender pass never
touches three.js.

## Forms, analytics, OG images

- **Reserve / founding-lab / notify forms** POST to `api/reserve.js` (a Vercel serverless
  function). Configure storage with env vars on Vercel: `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` (inserts into a `reservations` table — see the comment in the
  function for the schema) or `RESERVE_WEBHOOK_URL` (forwards JSON). Until one is configured
  the endpoint returns 501 and the form falls back to a prefilled mailto, so no submission
  is lost. A honeypot field silently drops bots; add a WAF/rate-limit rule before launch.
- **Analytics** are first-party beacons to `api/event.js` (events: reserve_view,
  reserve_submit, docs_click, lab_apply_submit, notify_submit, dataset_download_click,
  demo_video_play). Set `ANALYTICS_WEBHOOK_URL` to receive them; unset, the endpoint 204s.
  No cookies, no IDs.
- **OG images** (`public/og/*.jpg`, 1200×630) are generated from the product stills in
  `renders/` by `node scripts/og-images.mjs` — rerun after re-rendering stills.
- **Market stats** on `/story` (and the home micro-stat) are footnoted to the numbered
  sources list at `/story#sources` (`SOURCES` in `src/content/product.ts`); forecasts are
  labeled as projections. Street prices in the dev-kit comparison table are labeled with
  their as-of date — re-verify before each batch.

## Copy / content

All shared + home copy (hero, chapters, nav, footer, spec table) lives in
`src/content/product.ts`; sub-page copy lives in `src/content/pages.ts` — edit once, every
version updates. Contact + build-log links are at the top of `product.ts`. Unknown specs,
prices and dates are visible `[TODO: …]` placeholders by design — replace them with real
values as they land, never with guesses. Shared page chrome (header/nav, footer, email
capture, code cards) is `src/site/chrome.tsx`; sub-page sections are `src/site/pages.tsx`
with additive styles in `src/site/pages.css` (the Noir design tokens in `src/v1/styles.css`
are the base and are unchanged).
