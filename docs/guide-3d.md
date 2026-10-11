# 3D hero guide

BigViz can render the centre of a screen as a real-time 3D scene instead of an image. Phase 1
ships one scene: a procedurally generated night-time digital-twin city with alert beacons.
No 3D models or textures are needed, so every screen is licence-clean and works offline.

Live demo: the template's `#/city` route (`npm run dev`, then open `/#/city`).

## Turn it on

```yaml
hero:
  mode: three      # image (default) | three
  scene: city      # only scene in phase 1
  seed: 7          # same seed → same city layout
  nodes: [...]     # become alert beacons on the map
```

With the agent, just say it: `/bigviz 智慧园区数字孪生大屏，3D 城市，深蓝科技风`.
The mockup prompt then describes the 3D city, and the cut list skips the hero image.

## Where the code lives

| Path (in `templates/vue3-echarts`) | What |
|---|---|
| `src/screen3d/ThreeStage.vue` | Canvas, renderer, loop, zoom-aware sizing, dispose, WebGL fallback |
| `src/screen3d/CityHero.vue` | Public component: city + beacons + camera tour |
| `src/screen3d/scenes/` | The procedural city |
| `src/views/City/` | Reference screen: glass panels over the city |

`three` is pinned to an exact version and lazy-loaded. 2D-only screens never download it.

## `CityHero`

```vue
<CityHero
  ref="city"
  :alerts="alerts"        <!-- { id, label, level: info|warn|critical, x, z, value?, unit? } -->
  :focus-id="focusId"
  :seed="7"
  :fallback="ASSETS['center-hub']"
  @select="(id) => (focusId = id)"
/>
```

`x` and `z` are normalised map coordinates from -1 to 1. Call `city.value.flyTo(id)` to move
the camera to an alert; the tour resumes after a few seconds.

## Rules the kit enforces

- WebGL2 by default. WebGPU is a later phase because kiosk PCs often run old browsers.
- Pixel ratio is `min(zoom × DPR, 2)`; higher values stall 4K walls.
- The loop stops while the page is hidden. Reduced motion renders one still frame.
- Everything is disposed on unmount. If WebGL fails, the `fallback` image is shown.
- The root gets `data-ready="true"` after the first frame, so screenshots wait for it.

## QA

Headless Chromium renders WebGL slowly. Give the scene a longer wait before shooting:

```bash
bigviz shot "http://localhost:5173/#/city" --wait 6000 --dpr 2 -o shots/city.png
bigviz shot "http://localhost:5173/#/city" --frames 8 --interval 400 -o shots/city-motion.png
```

A `--wait-for '[data-ready="true"]'` option is planned for phase 2.
