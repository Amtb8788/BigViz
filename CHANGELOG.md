# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added
- Eight panel types in the 2D kit: `gauge`, `liquid`, `radar`, `funnel`, `map` (choropleth,
  markers, flylines, click-to-drill via a GeoJSON loader), `scroll-table`, `alerts`, `flip`.
  New components `LiquidFill`, `GeoMap`, `ScrollTable`, `AlertFeed`, `FlipNumber`, option
  builders in `kit/2d/charts/options.ts`, and a bilingual component gallery at `#/gallery`.
- Panel catalog (`cli/src/bigviz/catalog.py`, mirrored by the template's `catalog.ts`): one
  source for valid `panels[].type` values and a per-type visual description that mockup
  prompts now use instead of a bare "<type> chart".
- Layering test for the template kit (`cli/tests/test_template_layout.py`).
- 3D hero, phase 1: `src/kit/3d/` kit in the Vue template (`ThreeStage`, `CityHero`, a
  procedural digital-twin city with alert beacons and camera tour), demo route `#/city`,
  spec fields `hero.mode` / `hero.scene` / `hero.seed`, `docs/guide-3d.md`.
- `bigviz-3d` skill: three.js scene engine for animated construction sites, factories, parks,
  streets, tunnels and bridges (agents, roads and signals, progress, weather, IoT devices),
  with browser verify and video recording.
- GitHub Pages workflow that publishes the template as a live demo.
- Quick mode in the `bigviz` orchestrator: a first screen in 2–3 user turns. Studio mode
  keeps the full shoot-out / A/B / refine flow.
- Repository map and role table in both READMEs; `plugins/README.md`, `docs/README.md`.
- Chinese getting-started guide `docs/guide-getting-started.zh-CN.md`.
- Full usage guide in English and Chinese (`docs/USAGE.md`, `docs/USAGE.zh-CN.md`) and a 3D
  city showcase image; READMEs rewritten around the demo, highlights and docs map.

### Changed
- Template kit moved to `src/kit/` in three layers: `core/` (BigScreen, theme, palette, motion,
  shared types), `2d/` (`components/`, `charts/`, `catalog.ts`) and `3d/` (`components/`,
  `scenes/`). Replaces `src/screen/` and `src/screen3d/`.
  `BigVizAsset` and `AlertLevel` are defined once in `core/types`.

## [0.1.0]

### Added
- Six Agent Skills, the `bigviz` Python CLI, the Vue 3 + ECharts template, three presets and
  the `safety-points` example.
