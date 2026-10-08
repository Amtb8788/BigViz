---
name: bigviz
description: "End-to-end orchestrator that turns a one-line idea into a production big-screen data dashboard (Vue 3 + ECharts) through brief, AI mockup design, asset cutting/matting/HD regen, page build, visual QA and archive. Use when the user wants to create, redesign or finish a data dashboard, big screen, command center, cockpit, war room, NOC/SOC screen, visualization screen, KPI wall or large-display monitoring page, or says 数据大屏, 可视化大屏, 大屏设计, 驾驶舱, 指挥中心, 监控大屏, 数据可视化, 智慧工地大屏, 做个大屏. Also use when the user arrives mid-way: has a bigviz.yaml, has their own mockup image, has cut assets, or has a half-built screen to polish and QA."
---

# BigViz orchestrator

Drive a big-screen dashboard from idea to shipped page. Each phase has its own skill; this
skill decides where to start, enforces the gates and asks the user at every decision point.

## 0. Preflight (always)

1. Run `bigviz doctor`. If `bigviz` is not on PATH, use the fallback for every command:
   ```
   uvx --from "git+https://github.com/Amtb8788/BigViz#subdirectory=cli" bigviz <cmd>
   ```
2. Image commands (`probe`, `gen`, `edit`, `regen`) need `BIGVIZ_API_KEY` in the environment.
   Never write, print or commit the key. If it is missing, ask the user to export it, or offer
   the bring-your-own-mockup path (no key needed).
3. Never start long-running dev servers yourself. Ask the user to start them.

## 1. Pick the entry phase

Inspect the project, then start at the first phase whose inputs are missing:

| User has | Start at |
|---|---|
| Only an idea / one sentence | brief |
| `bigviz.yaml` but no picked mockup | design |
| Own mockup image (skip AI design) | brief (light) → set `design.final` → assets |
| `design.final` set, no `assets/final/` | assets |
| Published assets + `assets.manifest.ts` | build |
| A running screen | qa |

Bring-your-own mockup: copy it into `designs/`, run a light brief (panels, strings, locale)
so the spec matches the image, set `design.final`, then continue at assets.

## 2. Phases

Run each phase with its skill. Do not advance until the gate passes.

### brief → skill `bigviz-brief`
Gate:
- [ ] `bigviz.yaml` loads without errors (any `bigviz` command validates it).
- [ ] Every panel has exact data, not "sample data".
- [ ] 2–3 hero concepts in `hero.variants`.
- [ ] `pitfalls` lists the strings most likely to be garbled.
- [ ] `.bigviz-probe.json` exists; canvas plan matches the real returned resolution.

### design → skill `bigviz-design`
Decision points (ask the user, show a contact sheet each time):
1. Style: pick one preset from the shoot-out.
2. Hero: pick one variant from the A/B sheet.
3. Final mockup: pick the most text-accurate batch result.
4. Panel refine: ask which panels (if any) to refine.

Gate:
- [ ] `design.final` points to an existing file.
- [ ] All strings on the mockup match the spec (check `pitfalls` one by one).
- [ ] No duplicated rows, wrong units, wrong dates or garbled legends.
- [ ] Prompt files kept in `prompts/`; `design.versions` logs each iteration.

### assets → skill `bigviz-assets`
Gate:
- [ ] Cut list contains only image-worthy items (3D icons, hero, podium bases).
- [ ] Placeholders exist so build can start in parallel.
- [ ] Every final asset inspected on magenta and on the panel colour.
- [ ] `bigviz manifest` run after the last change; `bigviz publish` done (backup created).

### build → skill `bigviz-build`
Gate:
- [ ] Every spec panel maps to a component; data comes from the spec/mock, not inline.
- [ ] Geometry comes only from `assets.manifest.ts`.
- [ ] Reduced motion handled in JS and CSS; only transform/opacity animate.
- [ ] Typecheck and lint pass.

### qa → skill `bigviz-qa`
Gate:
- [ ] Full screen + per-panel shots at dpr 2–3 reviewed.
- [ ] Overlay against `design.final` shows no layout drift that matters.
- [ ] Motion sheet (8 frames) shows no flicker, blend breakage or blur.
- [ ] Hand-off checklist delivered.

### archive
1. Update `design.versions` with the final notes.
2. Keep `prompts/`, `designs/` sidecars and the `shots/` sheets; they make the run reproducible.
3. Leave `backup/` in place unless the user asks to clean it.
4. Summarise for the user: final mockup path, published asset dir, view path, open issues.

## 3. Working rules

- Ask, do not guess, at the four design decision points. Present options as a numbered list
  with the sheet path.
- Keep file names flat and versioned: `<slug>-<version>-<model>.png`.
- Panels, text and charts are code. Only 3D objects become images.
- Prefer an `edit` fix pass over regenerating a whole mockup that is 90% right.
- Read [references/pitfalls.md](references/pitfalls.md) before design, before assets and
  whenever output looks wrong. It lists known failure modes with fixes.
