---
name: bigviz-assets
description: "Cut production image assets out of a picked dashboard mockup: build the cut list, measure boxes, slice placeholders, matte backgrounds (unscreen / black / grabcut), erase baked-in text, AI-regenerate HD versions, write the manifest and publish into the app with automatic backup. Use when the user needs 3D icons, hero visuals or podium images from a big screen / data dashboard / command center mockup, wants transparent PNGs, background removal, matting, cutouts, HD upscale or asset regen, or says 大屏切图, 抠图, 去背景, 切图, 素材高清重绘, 图标抠图, 数据大屏素材."
---

# BigViz assets

Turn `design.final` into transparent, HD, measured PNGs plus `assets.manifest.ts` in the app.
Fallback when `bigviz` is missing:
`uvx --from "git+https://github.com/Amtb8788/BigViz#subdirectory=cli" bigviz <cmd>`.
Run `bigviz doctor` first. `regen` needs `BIGVIZ_API_KEY` in env; never hard-code it.
Method details and tuning: `docs/guide-matting.md` in the BigViz repo.

## Steps

### 1. Build the cut list
Images only for: 3D icons, the hero visual, podium/pedestal bases, decorative 3D objects.
Everything else is code: panel frames, titles, text, numbers, charts, progress bars, borders,
glow lines, backgrounds. When unsure, choose code.

### 2. Measure boxes
Open `design.final` and measure each object in its pixels: `box: [x, y, w, h]`. Include a
small clean margin of background around the object (needed for matting). Add to `assets[]`
with `id`, `box`, `matte`, `erase`, `regen`, `target`, `use`.

Merge overlapping parts into one asset: if the hero sits on a pedestal, or a medal overlaps
a podium, use one box for both. Separate crops of overlapping parts double-draw.

### 3. Slice placeholders
`bigviz slice` crops every box ×2 into `assets/placeholder/`. Tell the user that page build
can start now against placeholders.

### 4. Choose the matte method per asset

| Method | Use for | Notes |
|---|---|---|
| `unscreen` | glowing/glass icons on a tinted panel | estimates the background row by row, so vertical gradients do not leave haze |
| `black` | anything regenerated on pure black | the default after `regen` |
| `grabcut` | solid opaque metal or plastic objects | hard edges, no glow |
| `none` | already transparent inputs | |

Run `bigviz matte --ids <a,b>` (spec-driven) or `bigviz matte <src> <dst> --method …`.

### 5. Erase baked-in text
If the crop contains labels or numbers, list their boxes in `erase` and run
`bigviz erase <src> <dst> --boxes x,y,w,h;…`. Keep boxes tight. Large text areas: regen
with "no text" instead.

### 6. Regen (HD path)
The image API returns limited resolution, so crops are soft. `bigviz regen --ids … --jobs 3`
composites each reference on black, edits it with the P6 prompt (`regen.subject`,
`regen.fill`), mattes on black, trims and writes `assets/final/`. Set `regen: false` to skip
(final = matted alpha, resized to `target`).

Check each regen against its reference: same subject, pose, colours. Re-run with a lower
`fill` or a stricter subject if it recomposed.

### 7. Manifest and publish
1. `bigviz manifest` measures size, aspect and trim ratios into `assets/final/manifest.json`.
   Run it after every change to finals.
2. `bigviz publish --app <app-dir> --name <ViewName>` backs up to `backup/<timestamp>/`, copies
   finals to `<app>/src/assets/bigviz/<slug>/` and writes
   `<app>/src/views/<ViewName>/assets.manifest.ts`.
   Never copy files into the app by hand.

### 8. Inspect
`bigviz sheet "assets/final/*.png" --bg "#FF00FF" -o shots/assets-magenta.png` and again with
`--bg` set to the panel colour (palette `bg1`). Quote hex colours: an unquoted `#` starts a
shell comment. Look for halos, haze rectangles, cut-off
glow, holes in glass, leftover text. Fix and re-publish.

## Rules

- Never hard-code aspect ratios or offsets in the page; regen changes them. Geometry comes
  from the manifest.
- If an asset has asymmetric transparent margins, rely on the manifest trim ratios.
- Roll back a bad publish from `backup/<timestamp>/`.
- See the pitfalls reference in the `bigviz` skill for haze, smears and overlap failures.
