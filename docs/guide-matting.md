# Matting guide

Mockups have no alpha channel. Every crop carries its background: panel tint, gradient,
glow, sometimes text. This guide picks the right removal method per asset.

## What to cut at all

Only objects that code cannot draw well: 3D icons, the hero visual, podium and pedestal
bases, decorative 3D objects. Panel frames, text, numbers, charts, progress bars and glow
lines are code. Fewer images means fewer mattes to get wrong.

Merge overlapping objects (hero + pedestal, medal + podium) into one asset.

## Choosing a method

| Method | Best for | How it works | Watch out for |
|---|---|---|---|
| `unscreen` | glowing glass icons on a tinted panel | estimates the background colour per row, then un-mixes it so glow keeps partial alpha | needs clean background in each row of the box |
| `black` | anything regenerated on pure black | luminance-based alpha against #000000, colour un-premultiplied | dark parts of the object turn translucent |
| `grabcut` | solid metal or plastic objects | graph-cut segmentation, hard edge, optional feather | loses soft glow and transparency |
| `none` | already transparent inputs | copy | |

Rules of thumb:
- Glows, glass, light rays: `unscreen` from the mockup, or `regen` then `black`.
- Opaque, high-contrast objects: `grabcut`.
- Dark objects (navy metal): avoid `black`; use `grabcut` or `unscreen`.

## Commands

```bash
bigviz matte --ids center-hub,podium                 # uses each asset's `matte` field
bigviz matte in.png out.png --method unscreen
bigviz matte in.png out.png --method grabcut --feather 1.5
bigviz erase in.png out.png --boxes "150,760,40,50;200,760,40,50"
```

Quote `--boxes` (`;` separates commands in shells) and hex colours (`#` starts a comment).

## Vertical gradients and haze

Panels often fade from lighter at the top to darker at the bottom. A single background colour
leaves a faint rectangle ("haze") around the object. `unscreen` estimates the background row
by row. Give it a few pixels of clean background above, below and on both sides of the
object when measuring the box.

## Baked-in text

Mockups often print labels on or next to the object. List those boxes in `erase`.
`bigviz erase` inpaints and then interpolates rows so gradients continue. Keep boxes tight
around the glyphs; large boxes smear. If text covers a large part of the object, skip erase
and `regen` with "no text" in the prompt.

## The HD path: regen

Image APIs return limited resolution, so a crop is soft at screen size. `bigviz regen`:

1. composites the reference crop on pure black,
2. calls `edit` with the regen prompt (`regen.subject`, `regen.fill`),
3. mattes the result with `black`,
4. trims transparent margins,
5. writes `assets/final/<id>.png` at `target` px on the longest edge.

Regen can change the aspect and margins. Always run `bigviz manifest` afterwards; the page
reads geometry from `assets.manifest.ts`.

## Inspecting results

```bash
bigviz sheet "assets/final/*.png" --bg "#FF00FF" -o shots/assets-magenta.png
bigviz sheet "assets/final/*.png" --bg "#06173A" -o shots/assets-panel.png
```

Magenta exposes halos and leftover background. The panel colour shows how it will really
look. Check for halos, haze rectangles, clipped glow, holes in glass and leftover text.

## Publishing

`bigviz publish --app <dir> --name <ViewName>` backs up the current app assets to
`backup/<timestamp>/` before copying. Never copy finals into the app by hand; a bad regen
would overwrite live assets with no way back.
