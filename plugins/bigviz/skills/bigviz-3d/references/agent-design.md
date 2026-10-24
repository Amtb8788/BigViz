# Agent 能力封装：twin 技能族

目标：把“描述一个场景 → 得到可运行、可验收的写实数字孪生”封装成我们自己的 Agent Skills，结构对齐 BigViz（`plugins/bigviz/skills/bigviz` 编排器 + `bigviz-brief/design/assets/build/qa` 阶段技能），并能与其互相调用。

## 1. 技能族总览

```
skills/
  twin/            编排器：判断入口阶段、执行关卡、在每个决策点询问用户
  twin-brief/      需求访谈 → twin.yaml（场景规格）
  twin-scene/      布局与仿真 → scene.json（+ 可选 scene.hooks.js）
  twin-assets/     资产清单 → 采购/生成/规范化/压缩 → 资产注册表
  twin-iot/        设备、绑定、告警、适配器 → scene.json#twin
  twin-qa/         校验 + 浏览器截图 + 确定性仿真断言 + 性能报告
```

工作区约定（与 BigViz 的 `bigviz/<slug>/` 对齐）：

```
twin/<slug>/
  twin.yaml                 规格（brief 产物，所有后续阶段的唯一输入源）
  scene/scene.json          场景 DSL
  scene/scene.hooks.js      可选胶水函数（仅具名导出）
  assets/registry.json      资产注册表
  assets/src/  assets/glb/  原始与规范化后的资产
  twin/devices.json bindings.json alarms.json
  qa/<run-id>/              截图、report.json、录屏
```

## 2. 各技能的输入 / 产出

| 技能 | 输入 | 产出 | 关卡（gate） |
|---|---|---|---|
| `twin-brief` | 一句话需求、图纸/照片/BIM、业务系统清单 | `twin.yaml`：场景类型、尺寸与地理锚点、时间/天气、镜头列表、机械与材料清单、人员与车辆密度、路口与信号、设备点位、业务系统、渲染档与目标硬件 | 用户确认规格；所有数量与尺寸是具体数字，不允许“若干/适量” |
| `twin-scene` | `twin.yaml`、现有场景包（作参考） | `scene.json`：`terrain/ground/roads/intersections/places/entities/progress/shots/storyboards` | `validate-scene` 0 error；俯视截图 + 路网叠加图给用户确认布局 |
| `twin-assets` | `twin.yaml` 的资产清单、`scene.json` 中引用的 `asset.ref` | `registry.json` + GLB（Meshopt/KTX2/LOD）+ 缩略图 + 预算报告；缺失项标注 `fallback` | 每个资产：比例对（与人高 1.75 m 对照图）、朝向/原点对、rig 节点齐全、在预算内 |
| `twin-iot` | `twin.yaml` 的设备点位、业务系统接口说明、样例报文 | `devices.json`、`bindings.json`、`alarms.json`、适配器配置（不含凭据）、mock 剧本 | mock 下所有绑定都被触发过一次；每条告警规则有对应截图 |
| `twin-qa` | 构建产物 + 上述全部 | `qa/<run>/report.json`、截图集、联系表（contact sheet）、录屏 | `verify` 全 PASS；FPS 达到目标档；视觉检查清单逐项通过 |
| `twin` | 用户的任意入口 | 调度以上技能，维护 `twin.yaml#status` | 每阶段结束都给用户看证据（截图/报告）再进入下一阶段 |

入口判断（编排器 Preflight）：有 `twin.yaml` → 从 scene 开始；有 `scene.json` 无资产 → assets；只想挂设备 → iot；只想验收 → qa；什么都没有 → brief。

## 3. 多 Agent 工作流

```
brief ──► layout ──► assets ──┐
             │                 ├──► simulation ──► bindings ──► QA ──► hand-off
             └──── (并行) ─────┘                                 │
                       ▲                                         │
                       └──────────── 失败项回流到对应阶段 ◄──────┘
```

1. Brief（单 Agent，交互式）：按 `prompts.md` §A 模板访谈，产出 `twin.yaml`。
2. Layout（twin-scene）：先出 board/ground/roads/intersections/places，再放静态实体；产出俯视截图 `qa/layout-top.png` 与路网叠加图。用户确认后锁定坐标。
3. Assets（twin-assets，可并行 fan-out）：按资产清单每类一个子 Agent（机械 / 车辆 / 人物 / 材料 / 街道设施 / 建筑），各自走“查库 → 采购或生成 → 规范化 → 压缩 → 入册”。与 Simulation 并行，因为仿真只依赖 `fallback` 程序化模型即可开始。
4. Simulation（twin-scene 第二遍）：智能体计划、信号相位、任务模板、进度曲线、镜头与故事板。
5. Bindings（twin-iot）：设备挂载、绑定、告警、mock 剧本。
6. QA（twin-qa）：校验 → 构建 → verify → record → 视觉检查；失败项按类别回流（布局穿插 → scene，资产比例 → assets，告警未触发 → iot）。
7. Hand-off：产出可嵌入 BigViz 的 `TwinHero` 配置与交付清单。

并行与锁：各子 Agent 只写自己的文件（scene / registry / twin/*），`twin.yaml` 只有编排器写；共享引用（实体 id、资产 ref）在 brief 阶段一次定好，后续只读，避免 Agent 之间重命名冲突。

## 4. 工具与脚本

| 脚本 | 位置 | 使用者 | 功能 |
|---|---|---|---|
| `validate-scene.mjs` | `scripts/`（`npm run validate`，待实现） | scene / iot / qa | Schema + 引用完整性 + 几何合理性 + 预算；输出 `{errors, warnings}` JSON，非 0 退出码阻断 |
| `verify.mjs` | `scripts/`（已存在，`npm run verify`） | qa | 真实浏览器启动、所有 shots/关键天/夜晚/天气截图、确定性步进断言、FPS 与真实 renderer |
| `record.mjs` | `scripts/`（`npm run record`，待实现） | qa / hand-off | 播放 storyboard 录制 MP4/WebM（基于 `window.__diorama.play(id, true)` 与 `lastRecording()`） |
| `asset-normalize` | 新增（`gltf-transform` CLI 封装） | assets | 单位/朝向/原点、节点重命名为 rig 约定、Meshopt + KTX2、LOD、缩略图、预算报告 |
| `asset-scale-check` | 新增 | assets / qa | 把资产与 1.75 m 人体标尺并排渲染截图，测包围盒与登记尺寸偏差 |
| `twin-mock` | 新增（基于 src/twin mock 适配器） | iot / qa | 按剧本回放遥测：正常 → 预警 → 告警 → 恢复；可指定 seed |
| `contact-sheet` | 复用 BigViz `bigviz` CLI 的联系表能力或新增 | qa | 多张截图拼成一张便于人工/模型审阅 |

QA 断言通过 `window.__diorama` 自动化 API 实现（`step`、`stats`、`entities`、`shot`、`day`、`hour`、`weather`、`quality`），新增孪生 API 建议：`twin.emit(deviceId, values)`、`twin.state(entityId)`、`twin.alarms()`、`signals(intersectionId)`、`isolateFloor(id)`。

## 5. 视觉 QA 检查清单（twin-qa）

- 无纯色盒子作为近景主体（T2）；无移轴、无桌面（T2）。
- 比例：工人身高 ≈ 1.75 m，车道 3.5 m，标准层高 3–3.3 m，塔吊标准节约 1.6–2 m 截面。
- 落地：所有实体贴地，无悬空/穿地；车辆在车道内，行人在人行道/斑马线。
- 交通：红灯期间停止线后车辆速度为 0；路口内无车辆重叠（包围盒相交检测）。
- 告警：每个告警等级至少 1 张截图，颜色/信标/标签可辨。
- 光照：白天/黄昏/夜晚/雨天四张；夜晚有路灯与窗灯，雨天地面有湿反射。
- 性能：报告中写真实 renderer 名称与 FPS，不得在软件渲染器（SwiftShader）上宣称达标。

## 6. 与 BigViz 技能的衔接

| BigViz 阶段 | twin 对应 | 衔接点 |
|---|---|---|
| `bigviz-brief` | `twin-brief` | `bigviz.yaml` 的 hero 概念若为“3D 孪生”，编排器调用 `twin-brief`，并把 `twin.yaml` 路径写入 `bigviz.yaml#hero.twin` |
| `bigviz-design` | `twin-qa` 截图 | 设计稿中的 hero 区域可直接用 twin 的 T2 截图作为参考图，减少 AI 出图与实际 3D 的落差 |
| `bigviz-assets` | `twin-assets` | 大屏 2D 图标/切图归 BigViz；3D 模型归 twin。共用 `BIGVIZ_API_KEY` 的图像生成能力做 PBR 贴图与 image-to-3D 参考图 |
| `bigviz-build` | `TwinHero.vue` | 在 `src/kit/3d` 下与 `CityHero` 并列；数据走 `src/api/` 同一数据源 |
| `bigviz-qa` | `twin-qa` | BigViz QA 截全屏与面板；twin QA 截 3D 内部状态；两份报告合并为交付报告 |

调用方向：BigViz 编排器可以调用 twin 技能；twin 编排器在用户需要“大屏外壳”时调用 BigViz。两者都不复制对方的规格，只存路径引用。

## 7. 技能编写约定

- 每个 SKILL.md：frontmatter `name` + `description`（中英文触发词，如“智慧工地孪生、数字孪生、三维工地、红绿灯路口、设备上图、IoT 绑定”）；正文 ≤ 200 行，细节放 `references/`。
- 决策点必须询问用户：渲染档与目标硬件、资产来源（采购/生成/程序化）、是否接真实数据。
- 证据优先：每阶段结束给截图或报告路径，不用文字描述代替截图。
- 安全：不在任何场景/配置文件中写入密钥；MQTT/业务接口凭据通过环境变量或后端短时 token。

