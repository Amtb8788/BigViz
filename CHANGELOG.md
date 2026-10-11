# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added
- 3D hero, phase 1: `src/screen3d/` kit in the Vue template (`ThreeStage`, `CityHero`, a
  procedural digital-twin city with alert beacons and camera tour), demo route `#/city`,
  spec fields `hero.mode` / `hero.scene` / `hero.seed`, `docs/guide-3d.md`.
- GitHub Pages workflow that publishes the template as a live demo.
- Quick mode in the `bigviz` orchestrator: a first screen in 2–3 user turns. Studio mode
  keeps the full shoot-out / A/B / refine flow.
- Repository map and role table in both READMEs; `plugins/README.md`, `docs/README.md`.
- Chinese getting-started guide `docs/guide-getting-started.zh-CN.md`.
- Full usage guide in English and Chinese (`docs/USAGE.md`, `docs/USAGE.zh-CN.md`) and a 3D
  city showcase image; READMEs rewritten around the demo, highlights and docs map.

## [0.1.0]

### Added
- Six Agent Skills, the `bigviz` Python CLI, the Vue 3 + ECharts template, three presets and
  the `safety-points` example.
