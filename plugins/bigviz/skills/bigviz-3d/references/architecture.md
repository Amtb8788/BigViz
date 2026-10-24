# 数字孪生平台架构（BigViz 3D → Twin Platform）

目标：把现有“桌面微缩沙盘”引擎演进为可接入真实业务的数字孪生平台，覆盖智慧工地、智慧工厂、智慧园区、城市街道四类场景。本文以当前代码为基线（`assets/engine/src`），说明每一层“现在有什么 / 要加什么 / 边界在哪”。

## 0. 现状基线（v3 引擎）

| 能力 | 现有实现 | 局限 |
|---|---|---|
| 场景数据 | `scenes/<id>/index.js` 导出 JS 对象：`meta, board, desk, clock, camera, terrain, ground, roads, places, props, buckets, entities, vars, progress, timeline, shots, storyboards, autoDirector, hooks, weather` | 是 JS 模块不是 JSON，含函数（`drive`、`call` step、`hooks`），无法被后端/LLM 安全生成与校验 |
| 资产 | `prefabs/index.js` 的 `PREFABS` 注册表，`kit.js` 用 `box/cone/group` 拼几何，`bake()` 合批 | 全部程序化盒子 + 纯色材质，天花板就是“玩具感” |
| 渲染 | `render/stage.js` `QUALITY = low/medium/high`，`tiltshift.js` 移轴，`desk.js` 桌面与图纸 | 移轴 + 桌面 = 微缩模型语汇，与“真实城市”目标冲突 |
| 仿真 | `systems/roads.js` `RoadGraph`（nodes/edges/lane，`route()`），`agents.js` 计划（`when` + `steps`），`core/world.js` 黑板（var/signal/lock） | 无信号灯、无车道级冲突、无跟驰模型；计划是脚本化剧情不是实时状态驱动 |
| 时间 | `clock.dayStart/dayEnd/secondsPerDay`，`progress.curves` 按天插值 | 只有“故事时间”，没有“真实时间 + 回放”的双时钟 |
| 自动化 | `window.__diorama`（shot/day/hour/weather/quality/step/stats/entities），`scripts/verify.mjs` | 无 `validate-scene`、`record` 脚本实体（package.json 已声明） |

结论：数据驱动的骨架（实体 + 计划 + 黑板 + 路网 + 镜头）可以复用；需要替换的是“资产层 + 渲染层”，需要新增的是“孪生数据层 + 室内层 + 业务集成层”。

## 1. 分层总览

```
┌──────────────────────────── 业务集成层 ────────────────────────────┐
│ 工单 / 进度计划(BIM 4D) / 视频 / 门禁 / 告警处置 / BigViz 大屏         │
├──────────────────────────── 孪生数据层 src/twin ───────────────────┤
│ 实体树 site→building→floor→room→component · 设备模型 · 绑定 · 告警 · 历史 │
│ 适配器: MQTT(ws) / WebSocket / HTTP 轮询 / Mock                        │
├──────────────────────────── 仿真层 systems/* ──────────────────────┤
│ 路网图 · 信号相位 · 智能体与任务 · 黑板 · 时钟(故事/实时/回放)          │
├──────────────────────────── 渲染层 render/* ───────────────────────┤
│ T0 2D 平面 · T1 基础 3D(程序化) · T2 写实 3D(glTF+PBR+IBL)             │
├──────────────────────────── 资产层 assets registry ────────────────┤
│ glTF/GLB + Draco/Meshopt + KTX2 · LOD · Instancing · 程序化兜底         │
│ 后续输入: BIM/IFC · 3D Tiles · GIS(GeoJSON/倾斜摄影)                   │
├──────────────────────────── 场景 DSL (JSON Schema) ────────────────┤
│ scene.json + 可选 scene.hooks.js（仅胶水逻辑）                         │
└────────────────────────────────────────────────────────────────────┘
```

依赖方向只能自上而下：业务层只通过孪生层 API 读写；孪生层只改实体的“属性”，不直接碰 three.js 对象；渲染层把属性映射为视觉状态。

## 2. 场景 DSL（scene.json + JSON Schema）

原则：场景主体必须是纯 JSON（可被 LLM 生成、被 `validate-scene` 校验、被后端存储与版本化）；函数只允许出现在可选的 `scene.hooks.js`，并通过名字引用（`"fn": "hooks.loadTruck"`）。现有 JS 场景包继续可用，加载器把它当作“已解析的 DSL”。

顶层字段（在现有字段基础上扩展，新增字段标 ★）：

```
meta        { id, title, seed, kind★: "site"|"factory"|"park"|"street", units: "m", geo★: { lat, lon, alt, crs } }
render★     { tier: "2d"|"basic"|"real", desk: false, tiltShift: false, env: "hdri/overcast_4k.ktx2", exposure, fog }
clock       { mode★: "story"|"realtime"|"replay", dayStart, dayEnd, secondsPerDay, tz★: "Asia/Shanghai" }
camera      { home, bounds, minDist, maxDist, colliders }
terrain / ground / roads / places / props / buckets   （沿用）
intersections★  信号路口（见 §4）
entities    实体列表；新增 parent★、tags★、asset★、twin★
twin★       { devices: [...], bindings: [...], alarms: [...], adapters: [...] }
interiors★  楼层/房间定义（见 §6）
progress / timeline / shots / storyboards / autoDirector / weather   （沿用）
```

坐标约定沿用 `layout.js`：米制，+x 东，+z 南，y 向上；GIS 场景由 `meta.geo` 把局部 ENU 原点锚到经纬度。

### 2.1 场景实体示例（scene entry）

```json
{
  "id": "tc-01",
  "prefab": "towerCrane",
  "asset": { "ref": "crane/tower-qtz80", "lod": ["lod0", "lod1", "lod2"], "fallback": "towerCrane" },
  "name": "1# 塔吊 QTZ80",
  "parent": "site-zc/zone-a",
  "tags": ["machine", "lifting", "iot"],
  "x": 2, "z": -15.5, "ry": 0,
  "params": { "height": 46, "jib": 50, "counterJib": 12 },
  "life": { "windows": [[2.95, 12.2]], "enter": "rise", "exit": "lower" },
  "twin": {
    "props": {
      "slew":    { "type": "number", "unit": "deg", "drives": "agent.slew" },
      "load":    { "type": "number", "unit": "t" },
      "wind":    { "type": "number", "unit": "m/s" },
      "status":  { "type": "enum", "values": ["idle", "working", "alarm", "offline"] }
    },
    "anchors": { "cab": [0, 44, 1.2], "hook": "rig.hook", "base": [0, 0, 0] }
  },
  "agent": { "kind": "machine", "plans": [{ "id": "lift", "when": { "var": { "stock.rebar": [1, 99] } }, "steps": [{ "do": "crane", "pick": "pickRebar", "drop": "deck" }] }] },
  "info": { "role": "垂直运输 · 塔吊", "ring": 8 }
}
```

`asset.fallback` 指向现有 `PREFABS` 名，资产缺失时自动降级到程序化模型，保证场景始终可跑。`twin.props` 声明可被绑定的属性及其单位；`drives` 把属性直接接到已有 rig/agent 字段上（例如塔吊回转角接 `agent.slew`），这样实时数据和剧情动画共用同一套动画器。

### 2.2 校验

`scripts/validate-scene.mjs`（package.json 已声明 `npm run validate`，待实现）职责：JSON Schema 校验；引用完整性（`parent`、`places`、路网 node、`asset.ref`、`fallback` prefab、绑定的 entity/prop 是否存在）；几何合理性（实体是否落在 board 内、是否压路、塔吊回转半径内是否有障碍）；预算检查（三角形、draw call、纹理内存估算，见 §9）。

## 3. 资产管线与渲染分级

### 3.1 资产注册表

```json
{
  "id": "crane/tower-qtz80",
  "kind": "machine",
  "files": { "lod0": "crane/qtz80_lod0.glb", "lod1": "crane/qtz80_lod1.glb", "lod2": "crane/qtz80_lod2.glb" },
  "scale": 1.0, "up": "y", "front": "-z", "pivot": "base-center",
  "bbox": [6, 52, 62],
  "rig": { "slew": "Jib_Pivot", "trolley": "Trolley", "hook": "Hook", "cable": "Cable" },
  "lodDistances": [0, 80, 250],
  "budget": { "tris": [60000, 12000, 1500], "texMB": 12 },
  "license": "CC-BY-4.0 / 自有",
  "fallback": "towerCrane"
}
```

`rig` 把 glTF 节点名映射到现有动画器（`systems/animate-machines.js`）期望的骨骼名，这是程序化模型和真实模型能互换的关键：动画器只认“语义节点”，不关心几何来源。

### 3.2 管线步骤

1. 来源：采购/开源模型（Sketchfab、Poly Haven、厂商 CAD）、AI image-to-3D（见 `prompts.md` §B）、BIM 导出、摄影测量。
2. 规范化（Blender 脚本或 `gltf-transform`）：米制、Y-up、原点在底面中心、正面朝 -Z；按 `rig` 约定重命名节点；合并同材质网格；去除不可见面。
3. 压缩：几何 Draco 或 Meshopt（推荐 Meshopt，解码快）；纹理 KTX2（ETC1S 用于 albedo，UASTC 用于 normal/ORM），尺寸 2 的幂，单资产 ≤ 2K。
4. LOD：`gltf-transform simplify` 生成 lod1/lod2（约 20% / 3%），远景可用 impostor（八方向 billboard）。
5. 实例化：同一资产 ≥ 8 个时（工人、钢筋捆、路灯、车辆、树）走 `InstancedMesh` / `BatchedMesh`；动画角色用骨骼动画 + 实例化 VAT（顶点动画纹理）做远景人群。
6. 入库：生成上述注册表条目 + 缩略图 + 预算报告；`validate-scene` 拒绝超预算资产进入 `real` 档。

### 3.3 后续输入（P3）

- BIM/IFC：`web-ifc` 解析 → 按 `IfcBuildingStorey/IfcSpace/IfcElement` 生成实体树（site→building→floor→room→component），GlobalId 作为实体 `twin.extId`，几何转 glTF 并按楼层分块。
- 3D Tiles / 倾斜摄影：用 `3d-tiles-renderer` 作为城市底图，局部 ENU 原点由 `meta.geo` 对齐；工地/园区精模叠加在底图之上，底图只负责远景。
- GIS：GeoJSON 道路中心线 → 自动生成 `roads.nodes/edges` 与 `intersections`；建筑轮廓 + 层数 → 程序化体块或 3D Tiles。

### 3.4 渲染分级（render tier）

| 档 | 用途 | 内容 | 目标硬件 |
|---|---|---|---|
| T0 `2d` | 大屏小窗、低端机、无 WebGL 兜底 | 平面图 + 设备点位 + 状态色（Canvas/SVG，或 ECharts 地图） | 任意 |
| T1 `basic` | 当前引擎 | 程序化几何、简化 PBR、移轴可选 | 集显 60fps |
| T2 `real` | 写实孪生 | glTF PBR、HDRI IBL、ACES 色调映射、CSM/PCSS 阴影、SSAO、TAA/SMAA、湿地面反射、体积雾、无桌面无移轴 | 独显 60fps / 集显 30fps 降级 |

同一个 scene.json 三档通用：T2 用 `asset.ref`，T1 用 `asset.fallback`，T0 只用实体坐标 + 设备状态。档位选择：URL `?tier=` > 场景 `render.tier` > `systems/perf.js` 自动探测（现有 `autoQuality` 逻辑扩展为跨档降级）。

## 4. 仿真层

### 4.1 路网图

沿用 `RoadGraph`（`nodes: {id: [x,z]}`, `edges: [[a, b, {lane, width, site, dashes, surface}]]`, `route(from, to)`），扩展：

- 边属性：`lanes: {fwd: 2, back: 2}`、`speed`（km/h）、`oneway`、`class: "arterial"|"local"|"site"`。
- 车道级路径：`lanePoints()` 已按 `lane` 偏移，扩展为多车道 + 路口内转向连接线（turn connectors）。
- 跟驰与避让：IDM（智能驾驶员模型）简化版，前车距离 + 停止线；行人走 `sidewalk` 层的独立图。

### 4.2 信号路口与相位

```json
{
  "id": "x-rN",
  "node": "rN",
  "type": "signal",
  "approaches": { "N": "offN", "E": "rNE", "W": "rNW" },
  "heads": [
    { "id": "sig-rN-E", "approach": "E", "pos": [4.5, 0, -27], "kind": "vehicle-3", "asset": "street/signal-mast-arm" },
    { "id": "ped-rN-S", "approach": "S", "pos": [3, 0, -26.5], "kind": "ped-2" }
  ],
  "plan": {
    "cycle": 90, "offset": 0,
    "phases": [
      { "id": "P1", "green": ["E-W", "W-E"], "ped": ["N"], "g": 35, "y": 3, "allRed": 2 },
      { "id": "P2", "green": ["E-N", "W-N", "N-E", "N-W"], "g": 25, "y": 3, "allRed": 2 },
      { "id": "P3", "green": [], "ped": ["E", "W"], "g": 18, "y": 0, "allRed": 2 }
    ]
  },
  "twin": { "device": "dev-sig-rN", "mode": "plan|actuated|remote" }
}
```

相位状态写入黑板（`world.setVar('sig.x-rN.E', 'red')`），车辆计划在停止线处用已有 `waitVar` step 等待——不需要新增调度器；`mode: remote` 时由孪生层绑定真实信号机数据覆盖本地相位。

### 4.3 智能体与任务

现有 `agent.plans`（`when` 条件 + `steps` 脚本 + `lock/signal` 协同）适合“剧情”。孪生需要两种来源并存：

- 剧情计划（story）：沿用，用于演示与无数据时段。
- 任务驱动（task）：业务层下发 `{taskId, type: "deliver"|"lift"|"inspect"|"patrol", from, to, payload, eta}`，任务分配器把它翻译成 steps 序列（`drive → waitFor → crane → drive`），插入对应智能体的计划队列。
- 位置驱动（tracked）：人员定位卡/车辆 GPS/UWB 数据直接写 `agent.x/z/yaw`，动画器只负责插值与步态，计划暂停（`plan: null`）。

三种模式由实体 `agent.source: "story"|"task"|"tracked"` 切换；`tracked` 丢失信号超过 N 秒时显示“离线”幽灵态并停止插值，绝不编造位置。

### 4.4 时钟

`clock.mode`：`story`（现有按天播放）、`realtime`（墙钟，进度曲线由业务数据替代）、`replay`（从历史存储按时间窗回放 telemetry，支持 0.5x–60x）。三种模式共享 `E.step(dt)`，因此 `verify.mjs` 的确定性步进依旧可用。

## 5. 孪生数据层（src/twin）

### 5.1 实体树

```
site:zc            （项目/园区/厂区）
└─ building:tower  （单体）
   └─ floor:tower/F06
      └─ room:tower/F06/R601
         └─ component:tower/F06/R601/ahu-1   （任意组件：机器、构件、灯杆、阀门…）
```

任何场景实体都能通过 `parent` 挂入树中；路径式 id 便于按前缀订阅（`tower/F06/*`）。BIM 导入时 `extId` 保存 IFC GlobalId，业务系统用自己的编码时存在 `codes: {erp, cmms, bim}`。

### 5.2 设备模型

设备是“数据源”，实体是“被表现者”，二者多对多：一台塔吊可挂力矩限制器、风速仪、吊钩可视化摄像头；一个温湿度传感器也可只挂在某个房间上。

```json
{
  "id": "dev-tc01-limiter",
  "model": "tower-crane-monitor",
  "name": "1# 塔吊安全监控仪",
  "attachTo": { "entity": "tc-01", "anchor": "cab" },
  "vendor": "示例厂商", "sn": "TCM-2024-0001",
  "protocol": "mqtt",
  "topic": "site/zc/crane/tc01/telemetry",
  "points": {
    "load":   { "path": "$.load_t",      "unit": "t",   "range": [0, 8] },
    "moment": { "path": "$.moment_pct",  "unit": "%",   "range": [0, 120] },
    "wind":   { "path": "$.wind_ms",     "unit": "m/s" },
    "slew":   { "path": "$.slew_deg",    "unit": "deg" },
    "online": { "from": "heartbeat", "timeout": 30 }
  },
  "marker": { "icon": "sensor-crane", "showLabel": "hover" }
}
```

`attachTo.anchor` 可以是 `twin.anchors` 中的命名点、glTF 节点名或局部坐标 `[x,y,z]`，因此设备可挂在“任意组件”上；未声明 anchor 时挂在包围盒顶面中心。设备模型（`model`）是可复用模板，定义默认点位、单位、告警阈值、图标。

### 5.3 绑定：topic → 实体属性 → 视觉状态

```json
{
  "id": "bind-tc01-moment",
  "source": { "device": "dev-tc01-limiter", "point": "moment" },
  "target": { "entity": "tc-01", "prop": "moment" },
  "transform": { "smooth": 0.5, "clamp": [0, 120] },
  "visual": [
    { "when": "v >= 100", "state": "alarm",   "effect": { "tint": "#ff3b30", "pulse": 1.2, "beacon": true } },
    { "when": "v >= 90",  "state": "warning", "effect": { "tint": "#ffb020", "pulse": 0.6 } },
    { "when": "true",     "state": "normal",  "effect": { "tint": null } }
  ],
  "label": { "text": "力矩 {v:.0f}%", "anchor": "cab" }
}
```

规则：`when` 只允许受限表达式（比较、逻辑、`v`/`prev`/`dt`），由白名单解析器求值，绝不 `eval`。视觉效果是固定词表：`tint`、`emissive`、`pulse`、`beacon`、`label`、`gauge`、`flow`（管道流动）、`rotate`/`drive`（驱动 rig）、`visible`、`heat`（热力着色）。动作类数据（回转角、门开合、阀门开度）走 `drives`，状态类数据走 `visual`。

### 5.4 适配器

| 适配器 | 场景 | 说明 |
|---|---|---|
| `mqtt` | 主流 IoT 平台、EMQX、阿里云 IoT | 浏览器端 MQTT over WebSocket（`mqtt.js`），只订阅；凭据由后端短时 token 下发，不写入场景文件 |
| `ws` | 自研推送网关 | JSON 帧 `{topic, ts, data}` |
| `http` | 低频数据、无推送能力的系统 | 轮询 + ETag；默认 ≥ 5s |
| `mock` | 开发、演示、QA | 按设备模型生成正弦/随机游走/阶跃故障，seed 可复现 |

所有适配器归一为 `TelemetryFrame { deviceId, ts, values, quality }`，进入总线 `bus.emit('twin.frame', f)`。前端只读不写；控制指令（开关、复位）必须走业务后端并带鉴权与审计，不直接从浏览器发到设备。

### 5.5 告警与历史

告警规则 = 设备模型默认阈值 + 场景覆盖；状态机 `raised → acked → resolved`，含去抖（持续 N 秒）与恢复滞回。告警触发：实体着色 + 信标 + 事件日志（复用 `E.log`）+ 镜头可选飞行（复用 shots）。历史：前端只缓存最近 N 分钟环形缓冲用于迷你曲线；长期历史由后端时序库（TDengine / InfluxDB / TimescaleDB）提供，`replay` 时钟按时间窗拉取。

## 6. 室内层

```json
{
  "building": "tower",
  "floors": [
    { "id": "tower/F06", "level": 6, "elev": 19.8, "height": 3.3,
      "asset": "bldg/tower_F06.glb",
      "rooms": [
        { "id": "tower/F06/R601", "name": "601 机房", "poly": [[-12, -7], [-4, -7], [-4, 0], [-12, 0]], "use": "mech" }
      ],
      "nav": { "entry": [-14, 0], "graph": "tower/F06/nav" } }
  ]
}
```

- 楼层隔离：选中楼层后，上方楼层隐藏或半透明（`opacity 0.08` + 仅边线），下方楼层降饱和；外立面按剖切面（clipping plane）切开。程序化建筑沿用 `progressiveBuilding` 的逐层结构，可以直接按 floor 分组。
- 剖切：水平剖切（楼层）、竖向剖切（剖面盒 section box）两种；剖切面用填充材质封口，避免看到背面。
- 房间导航：每层一张小路网（复用 `RoadGraph`，`site: true` 类边）；点击房间 → 计算路径 → 第一人称/跟随镜头沿路径过渡。
- 镜头过渡：外景 → 楼层俯视（正交感的高 FOV 俯角）→ 房间（第一人称 1.6 m 视高）；三段都作为 shot 定义，复用 `camera.play(shot, {blend})`。过渡期间降级渲染（关 SSAO）保证流畅。
- 按需加载：室内资产按楼层分块懒加载，进入楼层前预取，离开后保留 LRU 2 层。

## 7. 业务集成层

| 业务 | 接入方式 | 在场景中的表现 |
|---|---|---|
| 工单（CMMS/EAM） | HTTP 拉取 + WS 推送状态变化；工单绑定 `entity` 或 `extId` | 组件上挂工单图钉，颜色 = 工单状态；点击查看详情、跳转业务系统 |
| 进度计划 / BIM 4D | P6/Project/自研排程导出 `{taskId, elementIds, start, end, actualStart, actualEnd}` | 替换现有 `progress.curves`：构件按计划/实际时间显隐，偏差着色（超前绿 / 滞后红） |
| 视频监控 | GB/T 28181 / ONVIF 经流媒体网关转 WebRTC/HLS/FLV | 摄像头设备挂在灯杆/塔吊上，显示视锥；点击弹出视频窗口；告警联动自动打开最近摄像头 |
| 门禁 / 人员实名 | 闸机事件 + 定位卡 | 闸机计数入 `vars`，人员 `agent.source: tracked`；仅显示工号/班组，不在前端暴露身份证等 PII |
| 环境监测 | 扬尘 PM2.5/PM10、噪声、风速 | 热力着色 + 雾浓度驱动（复用 `weather` 系统的 fog）；超标触发喷淋动画 |
| 能耗（工厂/园区） | 电表/水表/燃气表 | 管线 `flow` 效果、楼层能耗热力 |

集成边界：场景只持有“引用”（实体 id、extId、工单号），业务数据永远从业务系统实时取，不复制到场景文件中。

## 8. 与 BigViz 大屏的衔接

BigViz 模板（`templates/vue3-echarts`）已有 `src/screen3d`：`ThreeStage.vue`（渲染器生命周期）、`CityHero.vue`（props: `alerts`, `focusId`, `seed`, `autoTour`, `fallback`, `labelInsets`；事件: `select`, `fallback`），以及 `src/api/` 数据接口层。衔接方案：

1. 新增 `TwinHero.vue`（与 `CityHero` 同形）：`props: { scene: string | SceneJson, focusId, tier, labelInsets, fallback }`，`emit: select(entityId), alarm(alarm), fallback(reason)`，暴露 `flyTo(id)`、`isolateFloor(id)`。内部以 iframe 或直接 import 引擎包加载场景；推荐打包为 `@bigviz/3d-engine` ESM 库，由 BigViz 的 `ThreeStage` 托管 renderer。
2. 数据单一来源：大屏面板（ECharts）和 3D 孪生读同一个 `src/api/` 数据源；孪生层的 `TelemetryFrame` 也可推给面板，避免两套轮询。
3. 联动：面板点击告警 → `twin.flyTo(entity)`；3D 中选中设备 → 面板切换为该设备的趋势图；`labelInsets` 让 3D 标签避开两侧面板。
4. 降级：WebGL 不可用或 `perf` 检测不足时，`TwinHero` 切 T0 2D 平面（同实体坐标）而不是静态图。

## 9. 性能预算

以“集显笔记本（Intel Iris Xe / UHD 770 级）1080p @ 30fps”为底线，独显（RTX 3060 级）@ 60fps 为目标：

| 指标 | 集显 T2 | 独显 T2 | T1 |
|---|---|---|---|
| 可见三角形 | ≤ 1.5M | ≤ 5M | ≤ 500K |
| Draw calls | ≤ 300 | ≤ 1000 | ≤ 200 |
| 纹理显存 | ≤ 384 MB（KTX2 后） | ≤ 1.5 GB | ≤ 128 MB |
| 阴影 | 1 级 CSM 2048，仅近景投射 | 3 级 CSM | 1024 / 关 |
| 后处理 | SMAA + 简化 SSAO（半分辨率） | TAA + GTAO + Bloom | 无 / Bloom |
| 动态角色 | 高精度骨骼 ≤ 30，其余 VAT 实例 ≤ 500 | 骨骼 ≤ 120 | 程序化 ≤ 200 |
| 移动车辆 | ≤ 150 | ≤ 600 | ≤ 150 |
| 设备标签（DOM/CSS2D） | ≤ 60 同屏，其余聚合 | ≤ 150 | ≤ 60 |

手段：视锥 + 距离剔除；LOD；实例化；静态物体 `bake()` 合批（已有）；标签聚合与屏幕空间避让；遥测帧节流（视觉更新 ≤ 10Hz，插值补帧）；`perf.js` 连续 3 秒低于目标时自动降一档（关 SSAO → 降阴影 → 降 DPR → 切 T1）。

## 10. 诚实的边界

- 写实度的上限由资产决定。程序化 `box/cone` 无论加多少后处理都到不了“照片级”：缺少倒角、细节法线、磨损、真实比例的结构件。T2 必须有真实 glTF（采购、扫描或 AI 生成后人工修整），程序化模型只作兜底与远景。
- AI image-to-3D（Tripo、Meshy、Rodin、Hunyuan3D 等）目前适合中远景单体（钢筋捆、水泥罐、路障、配电箱）；塔吊、挖掘机这类细长桁架和可动关节结构，生成结果拓扑差、无法绑定，需要人工建模或采购成品后再做 rig 映射。
- 人物写实成本最高：PPE 工人需要骨骼动画（Mixamo 类动作库），近景 ≤ 几十个；大量人群只能 VAT 实例化，近看会穿帮。
- 浏览器端不做物理精确仿真：交通是“可信”而非“可标定”的；需要交通工程级结果时接 SUMO 等外部仿真器，前端只回放。
- 集显上 T2 只能“精选近景写实 + 远景简化”；大范围城市必须依赖 3D Tiles 分级加载，不能把整城精模一次装入。
- 实时数据可信度：离线、延迟、质量位（`quality`）必须在视觉上可见；不对缺失数据做插值伪造。
- 浏览器直连 MQTT 只适合只读订阅；控制类操作、凭据管理、审计必须在后端完成。

## 11. 分阶段路线图

### P0 写实底座（2–3 周）
内容：`render.tier` 三档切换，T2 关闭桌面与移轴，HDRI + ACES + CSM + SMAA；资产注册表 + glTF 加载 + `fallback`；首批 10 个资产（塔吊、挖掘机、搅拌车、渣土车、钢筋捆、模板堆、工人 PPE、红绿灯、路灯、围挡）；`validate-scene`、`record` 脚本落地。
验收：同一 construction 场景三档均可启动、`npm run verify` 全 PASS；T2 截图中无纯色盒子级主体资产；集显 1080p T2 ≥ 30fps（verify 报告真实 renderer 与 FPS）；资产缺失时自动降级且控制台无报错。

### P1 城市与孪生（3–4 周）
内容：多车道路网 + 信号路口相位 + 行人过街；`src/twin` 实体树、设备模型、绑定、mock 适配器、告警状态机；设备挂载任意组件；楼层隔离与房间导航。
验收：十字路口车辆按相位停/走，无穿车、无闯红灯（verify 中加入断言：红灯期间停止线内车速 = 0）；mock 下 ≥ 50 台设备 1Hz 更新，告警着色延迟 < 1s；点击楼层 → 隔离 → 进入房间镜头过渡 < 1.5s 且无穿模。

### P2 业务接入与大屏（3–4 周）
内容：MQTT/WS/HTTP 适配器（后端 token）；工单、4D 计划、视频、门禁四类集成样例；`TwinHero.vue` 接入 BigViz 模板；`replay` 时钟。
验收：用 EMQX 本地实例跑通端到端（设备 → 主题 → 绑定 → 着色 → 告警 → 面板联动）；4D 计划驱动构件显隐与偏差着色；BigViz 大屏 QA（`bigviz-qa`）截图通过，3D 标签不压面板。

### P3 规模化输入（持续）
内容：IFC 导入生成实体树；3D Tiles/倾斜摄影底图 + GIS 道路自动生成路网；工厂（产线、AGV、机械臂）与园区（能耗、安防、停车）场景包；SUMO 交通回放。
验收：示例 IFC（≥ 10 层）导入后楼层/房间树正确、构件 GlobalId 可点击查询；城区 3D Tiles 底图 + 工地精模在集显上 ≥ 30fps；工厂场景 AGV 由任务驱动无碰撞运行 30 分钟。

