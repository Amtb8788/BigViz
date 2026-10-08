---
name: bigviz-qa
description: "Visually verify a built big-screen dashboard: Playwright screenshots of the full screen and each panel at high DPR, overlay or diff against the picked mockup, 8-frame motion contact sheets, text-overflow checks at three panel heights, typecheck/lint, and a hand-off checklist. Use when testing, reviewing, polishing or signing off a data dashboard, big screen, command center, cockpit or visualization screen, comparing a page to its design, or when the user says 大屏验收, 大屏截图, 对比设计稿, 还原度检查, 数据大屏测试, 驾驶舱验收, 动效检查."
---

# BigViz QA

Prove the screen matches the mockup and behaves well, with images as evidence.
Fallback when `bigviz` is missing:
`uvx --from "git+https://github.com/Amtb8788/BigViz#subdirectory=cli" bigviz <cmd>`.
Run `bigviz doctor` first (it checks the Playwright browser).

## Steps

1. Server: ask the user to start the dev server and give you the URL. Never start
   long-running servers without asking. If the route needs login, ask for a login script and
   pass it with `--login-script`.
2. Full screen: `bigviz shot <url> --viewport 1920x1080 --dpr 2 -o shots/full.png`.
   Also shoot one off-ratio viewport (for example `2560x1080`) to check the aspect clamp.
3. Per panel: `bigviz shot <url> --dpr 3 --selector "<panel selector>" -o shots/panel-<id>.png`
   for every panel. Read each at full size: blur, clipped text, wrong numbers, misaligned icons.
4. Overlay: `bigviz overlay shots/full.png <design.final> --alpha 0.5` and with `--diff`.
   Check panel edges, hero position and asset sizes. Small text differences are expected;
   layout drift is not.
5. Motion: `bigviz shot <url> --frames 8 --interval 180 -o shots/motion` then
   `bigviz sheet "shots/motion-*.png" --cols 4 -o shots/motion-sheet.png`. Look for flicker,
   dark boxes from broken blend modes, elements jumping, blur during animation.
6. Text overlays at 3 panel heights: shoot at viewports `1920x1080`, `1920x900` and
   `1920x1200` (or toggle the host layout header) and check that titles, legends and rank rows
   neither overflow nor overlap.
7. Static checks: run the project's typecheck and lint and report the real output.
8. Reduced motion: if supported, shoot with reduced motion emulated and confirm loops stop.

## Hand-off checklist

Report to the user in this shape:

```
BigViz QA: <slug>
- Mockup: <design.final>
- Shots: shots/full.png, shots/panel-*.png, shots/motion-sheet.png, overlay
- Alignment: <ok / list of drifts with panel ids>
- Text: <all spec strings correct / issues>
- Motion: <ok / issues>
- Panel heights 1080/900/1200: <ok / issues>
- Typecheck: <pass / errors>  Lint: <pass / errors>
- Reduced motion: <ok / not checked>
- Open issues: <list or none>
```

Only claim a check passed if you ran it in this session. Say "not checked" otherwise.

## Fix loop

- Asset looks off (halo, size, offset): go back to `bigviz-assets`, fix, `manifest`, `publish`.
- Layout drift: fix the component against the overlay, re-shoot only that panel.
- Blur: check for `transform: scale` and ECharts DPR (see the pitfalls reference in the
  `bigviz` skill).
