---
name: bigviz-build
description: "Build the production Vue 3 + TypeScript + ECharts big-screen page from bigviz.yaml, the picked mockup and assets.manifest.ts: copy the vue3-echarts template or embed its src/kit folder into an existing app, map spec panels to components, wire entrance and loop motion with reduced-motion fallbacks, and scale with CSS zoom. Use when implementing or coding a data dashboard, big screen, command center, cockpit or visualization screen page, embedding a screen in an admin app, or when the user says 实现大屏页面, 写大屏代码, 数据大屏开发, 驾驶舱页面, 指挥中心页面, 大屏适配, 大屏动效."
---

# BigViz build

Implement the screen as code. Images are only the published 3D assets; panels, text and
charts are components.

## Steps

### 1. Choose the host
- New project: copy `templates/vue3-echarts` from the BigViz repo, then `npm ci`.
- Existing Vue 3 app: copy `src/kit/core/` and `src/kit/2d/` into the app's `src/kit/`, keep
  the `@` → `src` alias, and add `echarts` if missing. Do not add a UI library for the screen.
Ask the user which applies if it is not obvious from the repo.

### 2. Map panels to components
Read `bigviz.yaml` and `design.final`. For each panel in reading order:

| `type` | Component |
|---|---|
| `line`, `bar`, `pie`, `ring` | `ScreenPanel` + `ScreenChart` (ECharts option built from `data`) |
| `rank` | `ScreenPanel` + `RankList` |
| `kpi` / top-level `kpis` | `KpiCards` + `CountUp` |
| `podium` | `ScreenPanel` + published podium asset + `RankList` for the rest |
| `gauge`, `radar`, `funnel` | `ScreenPanel` + `ScreenChart` with `gaugeOption` / `radarOption` / `funnelOption` from `kit/2d/charts/options.ts` |
| `liquid` | `ScreenPanel` + `LiquidFill` |
| `map` | `ScreenPanel` + `GeoMap` (pass a `loader` that returns GeoJSON; ask the user for real boundaries, never invent them) |
| `scroll-table` | `ScreenPanel` + `ScrollTable` |
| `alerts` | `ScreenPanel` + `AlertFeed` |
| `flip` | `FlipNumber` (header strip or inside a panel) |
| `table`, `custom` | `ScreenPanel` + a local component |
| `hero` | `HeroHub` with the hero asset and `hero.nodes` |

Put data in a mock JSON next to the view (pattern: `src/mock/example.json`), not inline in
templates. Theme tokens come from `src/kit/core/theme.css` (CSS custom properties from the
palette); never hard-code colours.

### 3. Geometry
- Import `assets.manifest.ts` from the view folder. Width, height, aspect and trim come from
  it. Never hard-code aspect ratios or pixel sizes of images: regen changes them.
- Position against the 1920×1080 base canvas, matching the mockup.

### 4. Scaling
- `BigScreen.vue` scales with CSS `zoom` (aspect clamp 4/3–32/9). Do not use
  `transform: scale()`; it blurs text and charts.
- ECharts `devicePixelRatio = zoom × window.devicePixelRatio`, rounded to 0.5, max 4
  (`ScreenChart` does this).

### 5. Motion
- Entrance: follow the `ENTRANCE` timeline from `motion.ts` (header → KPIs → side panels →
  hero), staggered.
- Loops (count-ups, highlight rotation, rank shuffles): `useVisibleInterval` so they pause
  when hidden. Use prime-ish periods (for example 3700, 5300, 7900 ms) so loops do not sync.
- Reduced motion: honour it in JS (`useReducedMotion` skips loops and entrance) and in CSS
  (`@media (prefers-reduced-motion: reduce)` disables keyframes).
- Animate only `transform` and `opacity`.
- Front effect layers using `mix-blend-mode`: never animate the layer's `opacity` as a whole;
  it isolates the blend. Animate children instead.

### 6. 3D hero (`hero.mode: three`)
- Use `CityHero` from the template's `src/kit/3d/` kit as a full-bleed layer behind the
  panels; `views/City/` is the reference. Copy the whole `kit/3d/` folder and add `three`
  at the template's pinned version. Never import three statically from a 2D view, and keep
  `kit/2d` and `kit/3d` independent (both may import `kit/core`).
- Map `hero.nodes` and alert-like panel rows to `alerts` (`x`, `z` in -1..1); pass
  `hero.seed` as `seed`. Clicking a list row calls `flyTo(id)`.
- Pass the published hero image (if any) as `fallback`; it shows when WebGL fails.
- Side panels over the city get a translucent glass background so the scene shows through;
  keep the centre column free of panels so clicks reach the canvas.
- Rules the kit already enforces, do not undo them: pixel ratio capped at 2, loop paused
  when hidden, one still frame under reduced motion, full dispose on unmount.
- Details: `docs/guide-3d.md` in the BigViz repo.
- For a full animated scene (construction site, factory, park, street, tunnel, bridge, with
  workers, vehicles, progress and IoT devices) use the `bigviz-3d` skill instead of `CityHero`.

### 7. Embedding in a host admin layout
Inspect the wrapper chain for `height: calc(100vh - …)`, `overflow: hidden`, padding or
`min-height` rules. Give the screen route a full-bleed layout or a scoped override.

### 8. Verify
Run the project's typecheck and lint (template: `npm run typecheck`). Do not start the dev
server yourself; ask the user to start it, then hand off to `bigviz-qa`.

## Rules

- Real on-screen text comes from the spec, so it is always correct even when the mockup
  text was not.
- Keep components small; one file per panel when it needs local logic.
- Every looped effect needs a reduced-motion fallback.
- See the pitfalls reference in the `bigviz` skill (transform blur, host layout overrides,
  blend isolation, regen aspect).
