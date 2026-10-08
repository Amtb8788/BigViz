# BigViz template: Vue 3 + ECharts

Standalone Vite + Vue 3 + TypeScript + ECharts 5 big-screen template. No UI library, no
framework coupling. `src/screen/` is the reusable kit; `src/views/Example/` is a complete demo.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # vue-tsc --noEmit
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/
```

Node 20.19+ is required (Vite 7).

## Swap the data

The example fetches `mock/example.json` (served from `src/mock/` in dev, copied to `dist/mock/` on
build). To use a real backend, create `.env.local` with:

```bash
VITE_API_URL=https://api.example.com/screen/points
```

The response is validated in `src/api/screen.ts` (`parseScreenData`). A wrong shape fails with the
exact field path instead of rendering `NaN`. Update `src/views/Example/types.ts` and the parser
together when you change the contract. Data refreshes silently every 60 s. Refresh pauses while
the tab is hidden, and the last good data is kept on failure.

UI text lives in `src/views/Example/i18n.ts` (en / zh, toggled from the header). Data values such
as team or product names are shown as the API returns them.

## Assets from `bigviz publish`

```bash
bigviz manifest
bigviz publish --app path/to/this/template --name Example
```

`publish` backs up the old files, copies the final PNGs to `src/assets/bigviz/<slug>/`, and
rewrites `src/views/<Name>/assets.manifest.ts`:

```ts
export const ASSETS = {
  'team-podium': { id: 'team-podium', src: teamPodium, width: 1898, height: 810,
                   aspect: 2.3432, trim: { l: 0.0042, t: 0.0136, r: 0.0016, b: 0 } }
} as const satisfies Record<string, BigVizAsset>
```

Components take geometry from the manifest (`aspect`, `trim`) and never use typed-in ratios, so a
regenerated asset with a different size lays out correctly with no CSS edits. Do not edit the
manifest by hand.

## Kit (`src/screen/`)

| File | Purpose |
|---|---|
| `BigScreen.vue` | 1920×1080 design stage. Stretches to the container aspect (clamped 4/3–32/9), scales with CSS `zoom`, and is centred with flex. Exposes `zoom` and `pixelRatio`. |
| `ScreenPanel.vue` | Panel frame with entrance and ambient loops |
| `ScreenChart.vue` | ECharts host. `devicePixelRatio` = zoom × DPR, rounded up to 0.5 and capped at 4. The chart is rebuilt when that value changes. |
| `RankList.vue`, `CountUp.vue`, `KpiCards.vue` | Ranking bars, rolling numbers, KPI strip |
| `HeroHub.vue` | Centre artwork on an SVG orbit with N nodes |
| `Podium.vue` + `PodiumCrown.vue` | Base image with text overlay and an optional trophy effect (`crown` prop or `#back` / `#front` slots) |
| `motion.ts` | `ENTRANCE` timeline, `useVisibleInterval`, `useReducedMotion` |
| `theme.css` | `--bv-bg0 … --bv-text` tokens (preset palette keys) |

Only `transform` and `opacity` are animated. Every looped effect has a `prefers-reduced-motion`
fallback.

Do not animate `opacity` on the podium front effect layer as a whole. That makes the layer an
isolated group, and its `mix-blend-mode: screen` children stop blending with the trophy.

## Embedding in an existing admin app

1. Route the screen as a full page and keep a fixed full-viewport wrapper:

   ```css
   .my-screen { position: fixed; inset: 0; z-index: 3000; }
   ```

   `BigScreen` fills its parent, so the parent needs a definite size. `position: fixed` keeps it
   independent of the host layout.
2. Watch for host layout rules. Admin shells often style the routed page root with `height: calc(100% - 60px)`,
   `padding`, or `overflow`, sometimes through ID selectors that beat scoped styles. The symptom is
   a screen that is 60 px short or cropped at the top. Use a dedicated blank layout for the route,
   or wrap the screen in your own element that the host rules do not target. Avoid `!important`
   overrides.
3. Import `src/screen/theme.css` once, and copy `src/screen/` as a folder.
4. Replace the plain `fetch` in `src/api/screen.ts` with the host's request helper if it needs
   auth headers. Keep `parseScreenData` at the boundary.

## Notes

- CSS `zoom` needs Chromium, Safari, or Firefox 126+.
- ECharts 5.6 is pinned (contract §6). `npm audit` reports an XSS advisory for echarts < 6.1.0.
  Custom tooltip formatters in this template escape API strings with `escapeHtml`. Do the same in
  any formatter you add.
