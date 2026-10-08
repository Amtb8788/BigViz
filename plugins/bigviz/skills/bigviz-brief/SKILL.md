---
name: bigviz-brief
description: "Turn a dashboard idea into a validated bigviz.yaml spec: interview for panels with exact data, 2-3 hero concepts, real on-screen strings, a pitfalls list of strings image models garble, and locale; probe the image API for its real resolution. Use when starting a data dashboard, big screen, command center, cockpit or visualization screen, when writing or editing bigviz.yaml, or when the user says 数据大屏需求, 可视化大屏, 驾驶舱, 指挥中心, 大屏规划, 写大屏 spec, 整理大屏数据."
---

# BigViz brief

Produce `bigviz/<slug>/bigviz.yaml` that is complete enough to generate an accurate mockup.
Spec reference: `docs/guide-spec.md` in the BigViz repo.

## Steps

1. Preflight: run `bigviz doctor`. If `bigviz` is missing, use
   `uvx --from "git+https://github.com/Amtb8788/BigViz#subdirectory=cli" bigviz <cmd>`.
2. Scaffold: `bigviz init <slug> --preset deep-tech-blue --locale en` (use `--locale zh` for
   Chinese on-screen text). Slug is kebab-case.
3. Probe early (needs `BIGVIZ_API_KEY` in env, never hard-code it):
   `bigviz probe`. Read `.bigviz-probe.json`. If the largest real size is below the canvas,
   tell the user: mockups will be upscaled for layout only, and HD assets come from `regen`.
   Skip the probe if the user brings their own mockup.
4. Interview, in at most three rounds, with concrete defaults the user can accept:
   - Round 1, purpose: title, project name shown top-left, audience, locale, header
     (clock / weather), canvas (default 1920×1080).
   - Round 2, data: 6–8 panels across left / center / right. For each: title, type
     (`line|bar|pie|ring|rank|podium|kpi|table|custom`) and exact data (labels, values,
     units, 5 rows for ranks). Plus 3–5 KPIs with label, value, unit, icon.
   - Round 3, hero: propose 2–3 hero concepts as one-line visual descriptions
     (`hero.variants`), and the orbit nodes (`hero.nodes`) with labels and icons.
5. Write real strings. Every title, legend, label, name and unit in the spec is what appears
   on screen, verbatim. No lorem ipsum, no "Panel 1".
6. Build `pitfalls`: list the exact strings the model is likely to garble:
   - CJK names and masked names (`Liu*Qiang`, `刘*强`)
   - near-duplicate labels (`Monthly Earned` vs `Monthly Redeemed`)
   - units that differ between similar rows (`pts` vs `times`)
   - dates, times, weekdays
   - legends with 3+ items
7. Validate: run any command that loads the spec (for example `bigviz prompt design`).
   Fix every reported path (unknown keys are errors).
8. Show the user a short summary table (panels, KPIs, hero variants, pitfalls) and ask for
   confirmation before moving to design.

## Rules

- Exact data beats plausible data. If the user has no data yet, write fictional but specific
  numbers and say so.
- Keep layout columns at `[24, 52, 24]` unless the user wants otherwise.
- Use the panel `notes` field for designer hints (emphasis, chart style), not for data.
- Leave `design.final` and `assets` empty; later phases fill them.
- Bring-your-own mockup: transcribe the panels and strings from the image instead of
  interviewing, then set `design.final` to the copied file in `designs/`.
