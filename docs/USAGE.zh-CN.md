# BigViz 使用手册

从 `git clone` 到大屏上墙，所需的一切都在这里。第一次建议从头读到尾，之后按需跳到对应章节。

[English](USAGE.md) · [返回 README](../README.zh-CN.md)

**目录**

1. [环境要求](#1-环境要求)
2. [一分钟跑起演示](#2-一分钟跑起演示)
3. [安装](#3-安装)
4. [用 AI 做第一块大屏](#4-用-ai-做第一块大屏)
5. [CLI 命令参考](#5-cli-命令参考)
6. [使用前端模板](#6-使用前端模板)
7. [3D 数字孪生城市](#7-3d-数字孪生城市)
8. [构建与部署](#8-构建与部署)
9. [常见问题排查](#9-常见问题排查)
10. [参与开发 BigViz](#10-参与开发-bigviz)

## 1. 环境要求

| 工具 | 版本 | 用途 |
|---|---|---|
| Node.js | 20.19+ | 运行 Vue 3 模板（Vite 7） |
| Python | 3.10+ | `bigviz` 命令行工具 |
| [uv](https://docs.astral.sh/uv/) | 最新版 | 安装 / 运行 CLI（推荐） |
| AI 编程助手 | Claude Code、Cursor、Codex 等 | 使用技能（可选，CLI 可单独用） |
| OpenAI 兼容 Images API Key | — | AI 出设计稿、高清重绘（可选） |
| Playwright 的 Chromium | — | `bigviz shot` 截图（可选） |

只想看演示的话，只需要 Node。

## 2. 一分钟跑起演示

```bash
git clone https://github.com/Amtb8788/BigViz.git
cd BigViz/templates/vue3-echarts
npm install
npm run dev
```

| 地址 | 页面 |
|---|---|
| <http://localhost:5173/> | 2D 安全指挥中心（ECharts） |
| <http://localhost:5173/#/city> | 3D 智慧城市运营中心（three.js） |
| <http://localhost:5173/#/gallery> | 2D 组件库：仪表盘、水球、雷达、漏斗、下钻地图、滚动表格、告警流、翻牌器 |

如果 5173 端口被占用，Vite 会自动换一个端口，以终端打印的地址为准。每个页面右上角都有中英文切换按钮，
数据来自 `src/mock/` 下的模拟数据。

## 3. 安装

### 3.1 安装技能

**Claude Code**（在 Claude Code 会话里输入）：

```
/plugin marketplace add Amtb8788/BigViz
/plugin install bigviz@bigviz
```

会装上 6 个技能和 3 个斜杠命令：`/bigviz`、`/bigviz-regen`、`/bigviz-qa`。

**其他支持 [Agent Skills](https://agentskills.io) 标准的工具**：把技能文件夹复制到工具的技能目录。

```bash
git clone https://github.com/Amtb8788/BigViz
cp -r BigViz/plugins/bigviz/skills/* .agents/skills/     # 或 .cursor/skills/、~/.codex/skills/
```

### 3.2 安装 CLI

```bash
# 安装一次，之后任意目录都能用 bigviz
uv tool install "git+https://github.com/Amtb8788/BigViz#subdirectory=cli"

# 或者免安装直接运行
uvx --from "git+https://github.com/Amtb8788/BigViz#subdirectory=cli" bigviz doctor

# 截图功能需要 Playwright 扩展和浏览器（只需一次）
uv tool install --force --with-executables-from playwright \
  "bigviz[shot] @ git+https://github.com/Amtb8788/BigViz#subdirectory=cli"
playwright install chromium
```

用 pip 也可以：`pip install "git+https://github.com/Amtb8788/BigViz#subdirectory=cli"`。

### 3.3 配置出图服务

```bash
export BIGVIZ_API_KEY=...                          # probe / gen / edit / regen 需要
export BIGVIZ_BASE_URL=https://api.openai.com/v1   # 任意 OpenAI 兼容 Images API 或代理
export BIGVIZ_MODEL=gpt-image-1
```

Windows PowerShell 用 `$env:BIGVIZ_API_KEY = "..."`。Key 放在 shell 配置或密钥管理工具里，
不要放进仓库。`.env` 文件已被 git 忽略，CI 会用 gitleaks 扫描泄露。

### 3.4 检查环境

```bash
bigviz doctor
```

会逐项检查 Python 依赖、Playwright、Chromium 和 API 环境变量，缺什么就提示怎么装。

## 4. 用 AI 做第一块大屏

### 4.1 快速模式（默认）：回复 2–3 次

```
/bigviz 智慧园区运营大屏：能耗、门禁、停车、告警，深蓝科技风，中文
```

| 轮次 | AI 做什么 | 你回复 |
|---|---|---|
| 1 | 写好完整需求（6 个面板、4 个指标、虚构示例数据），给出汇总表 | "可以" 或者要改的地方 |
| 2 | 出 4 张设计稿，统计每张的错字数，推荐一张 | "用 2 号" |
| 3 | 修字、切素材、写 Vue 页面、通过类型检查 | 启动开发服务器 |

你运行 `npm run dev` 之后，AI 会截图、与设计稿叠图对比，并告诉你还有哪些地方可以打磨。

### 4.2 精修模式：每一步都由你决定

说"用精修模式"。AI 会在四个节点停下来让你选：多预设风格比稿、主视觉 A/B、定稿、逐个面板精修。

### 4.3 说法小抄

| 想要 | 这样说 |
|---|---|
| 换风格 | "换成 editorial-dark" / "换成玻璃拟态" |
| 3D 中心 | "中间做成 3D 数字孪生城市，告警点能点击" |
| 照已有设计稿做 | "我有设计稿，在 designs/foo.png，照着做" |
| 接真实数据 | "面板数据改成调 /api/screen 接口" |
| 只改一块 | "左下角面板太空了，精修一下" |
| 重绘单个素材 | `/bigviz-regen center-hub` |
| 重新验收 | `/bigviz-qa http://localhost:5173/` |

### 4.4 没有 API Key

AI 会直接用模板自带的素材做出页面，并列出之后需要替换的图片。如果你有设计稿，就走
[5.3 照已有设计稿做](#53-照已有设计稿做) 的流程。

## 5. CLI 命令参考

所有命令都支持 `--spec PATH`，默认使用当前目录的 `./bigviz.yaml`，或者当前目录下唯一的
`bigviz/*/bigviz.yaml`。加 `-v` 输出调试日志，任意命令加 `-h` 查看完整参数。

### 5.1 命令一览

| 阶段 | 命令 | 作用 |
|---|---|---|
| 准备 | `bigviz init <slug> [--preset P] [--locale en\|zh]` | 创建工作区 `bigviz/<slug>/` 和初始需求文件 |
| | `bigviz doctor` | 检查依赖、浏览器、API 环境变量 |
| | `bigviz probe [--sizes …]` | 发几个低质量小请求，把实际返回尺寸记录到 `.bigviz-probe.json` |
| 设计 | `bigviz prompt design [--variant P] [--hero KEY]` | 生成整屏设计稿提示词，保存到 `prompts/` |
| | `bigviz prompt panel <id>` / `prompt paste <id>` | 精修单个面板，再贴回设计稿 |
| | `bigviz prompt fix` / `prompt regen <asset>` | 修字提示词；单个素材的高清重绘提示词 |
| | `bigviz gen <prompt> --tag v1 [--n 4] [--quality high]` | 文生图到 `designs/`，自动命名，附 JSON 记录 |
| | `bigviz edit <prompt> --image a.png[,b.png] --tag v2` | 图像编辑：修字、面板贴回、重绘 |
| | `bigviz sheet "<glob>" [-o out.png]` | 带编号的对比拼图 |
| 素材 | `bigviz slice [--ids a,b]` | 按 `assets[]` 从 `design.final` 切图到 `assets/placeholder/`（放大 2 倍） |
| | `bigviz matte --ids a,b` 或 `matte SRC DST --method …` | 抠图：`unscreen`、`black`、`grabcut`、`none` |
| | `bigviz erase SRC DST --boxes x,y,w,h;…` | 去除素材里烘焙的文字（修复 + 逐行插值） |
| | `bigviz regen [--ids …] [--jobs 3] [--dry-run]` | AI 高清重绘 → 黑底抠图 → 裁边 → `assets/final/` |
| | `bigviz manifest` | 测量每个成品素材的尺寸、比例、留白 |
| | `bigviz publish --app <dir> [--name View]` | 先备份，再把成品拷进前端工程，生成 `assets.manifest.ts` |
| 验收 | `bigviz shot <url> [--dpr 2] [--frames 8] [--wait ms]` | Playwright 截图或动效连拍 |
| | `bigviz overlay <shot> <design> [--alpha 0.5] [--diff]` | 截图与设计稿叠图或差异热力图 |

### 5.2 完整流程（AI 出设计稿）

```bash
bigviz init my-screen --preset deep-tech-blue --locale zh
cd bigviz/my-screen
bigviz probe

# 1. 编辑 bigviz.yaml：标题、面板、指标、数据、主视觉、易错文字（见 guide-spec.md）

# 2. 设计
bigviz prompt design                               # 生成 prompts/<file>.txt
bigviz gen prompts/<file>.txt --tag v1 --n 4
bigviz sheet "designs/*-v1-*.png" -o shots/v1-sheet.png
#    选一张 → 在 bigviz.yaml 里设置 design.final
#    有错字？bigviz prompt fix，再 bigviz edit … --image designs/<final>.png --tag v2

# 3. 素材：按 design.final 的像素坐标量出每个素材框 → 填进 bigviz.yaml 的 assets[]
bigviz slice                                       # 先出占位图，前端可以马上开工
bigviz matte --ids center-hub
bigviz regen --jobs 3
bigviz manifest
bigviz publish --app ../../my-app --name MyScreen

# 4. 验收（先自己启动开发服务器）
bigviz shot http://localhost:5173/ --dpr 2 -o shots/full.png
bigviz overlay shots/full.png designs/<final>.png --alpha 0.5 --diff
bigviz shot http://localhost:5173/ --frames 8 --interval 180 -o shots/motion.png
```

### 5.3 照已有设计稿做

1. `bigviz init my-screen`，把设计稿复制到 `bigviz/my-screen/designs/`。
2. 对照图片填写 `bigviz.yaml`，设置 `design.final`。
3. 量出 `assets[]`。没有 Key 就给每个素材设 `regen: false`。
4. `bigviz slice && bigviz matte && bigviz manifest && bigviz publish --app …`

这几步都不调用出图接口。

### 5.4 工作区结构

```
bigviz/<slug>/
├── bigviz.yaml          # 需求文件，唯一事实来源
├── prompts/             # 每次生成的提示词，便于复现
├── designs/             # <slug>-<版本>-<模型>[-n].png + 同名 .json 记录
├── assets/
│   ├── placeholder/     # 直接裁切 ×2
│   ├── alpha/           # 从设计稿抠出的素材
│   ├── regen/<id>/      # 高清重绘结果
│   └── final/           # 可发布的 PNG + manifest.json
├── shots/               # 截图、叠图、对比图
└── backup/<时间戳>/     # 每次 publish 前的自动备份
```

`designs/`、`assets/`、`shots/`、`backup/` 已被 git 忽略，提交需求文件和提示词即可。
字段详解见 [guide-spec.md](guide-spec.md)，抠图技巧见 [guide-matting.md](guide-matting.md)。

## 6. 使用前端模板

`templates/vue3-echarts` 就是最终交付物。可以整个复制成新项目，也可以把组件拷进现有项目。

### 6.1 常用脚本

```bash
npm install
npm run dev         # 开发服务器，热更新，http://localhost:5173
npm run typecheck   # vue-tsc --noEmit
npm run build       # 类型检查 + 生产构建，输出到 dist/
npm run preview     # 本地预览 dist/
```

### 6.2 目录结构

```
src/
├── App.vue              # hash 路由：#/city → 3D 城市，#/gallery → 组件库，其他 → 示例大屏
├── api/                 # fetch + 运行时校验（screen.ts、city.ts、validate.ts）
├── mock/                # example.json、city.json（开发时映射到 /mock/*.json）
├── assets/bigviz/       # bigviz publish 写入的素材
├── kit/                 # 可复用组件库，可整体拷到其他项目
│   ├── core/            # 2D 和 3D 共用：BigScreen、theme.css、配色、动效、公共类型
│   ├── 2d/              # ECharts + DOM 面板（依赖 echarts）
│   │   ├── components/  # ScreenPanel、ScreenChart、GeoMap、RankList……
│   │   ├── charts/      # 按需引入的 ECharts 和图表配置
│   │   └── catalog.ts   # panels[].type → 组件
│   └── 3d/              # three.js 主视觉，懒加载（依赖 three）
│       ├── components/  # CityHero、ThreeStage
│       └── scenes/      # 程序化城市
└── views/               # 用组件库拼出来的页面
    ├── Example/         # 2D 参考大屏
    ├── Gallery/         # 全部 2D 面板组件
    └── City/            # 3D 参考大屏
```

依赖只有一个方向：`2d` 和 `3d` 都可以引用 `core`，`views` 可以引用任意一层；`2d` 和 `3d` 互不引用
（CLI 测试会检查）。只做 2D 的项目可以直接删掉 `kit/3d/`。

### 6.3 接入真实数据

在 `package.json` 同级目录新建 `.env.local`：

```bash
VITE_API_URL=https://api.example.com/screen        # 2D 示例大屏
VITE_CITY_API_URL=https://api.example.com/city     # 3D 城市大屏
```

- 接口返回结构要与模拟 JSON 一致，最简单的做法是让后端照着 `src/mock/*.json` 返回。
- 校验逻辑在 `src/api/screen.ts` 和 `src/api/city.ts`。结构不对时会报出具体字段路径，而不是渲染出 `NaN`。
- 数据每 60 秒静默刷新，页面隐藏时暂停，请求失败时保留上一次的数据。
- 需要鉴权请求头？把原生 `fetch` 换成项目自己的请求封装，校验函数保留在边界处。
- 改了数据结构？`views/<页面>/types.ts` 和校验函数要一起改。

### 6.4 文案与语言

界面文案在 `views/Example/i18n.ts` 和 `views/City/i18n.ts`（`en` / `zh`），标题栏按钮切换。
数据里的值（班组名、地名等）按接口原样显示。

### 6.5 主题与布局

- 颜色是 `src/kit/core/theme.css` 里的 CSS 变量（`--bv-bg0 … --bv-text`），对应预设的配色键。
- `BigScreen` 按 1920×1080 设计稿布局，自适应容器比例（限制在 4:3 到 32:9 之间），用 CSS `zoom` 缩放，
  任何尺寸文字都清晰。
- 图表按 `zoom × devicePixelRatio` 渲染，4K 屏也不糊。
- 只对 `transform` 和 `opacity` 做动画，所有循环动效都遵循 `prefers-reduced-motion`。

### 6.6 新增一块屏

1. 把 `views/Example/` 复制成 `views/MyScreen/`。
2. 运行 `bigviz publish --app <模板目录> --name MyScreen` 生成它的 `assets.manifest.ts`。
3. 在 `App.vue` 注册路由：`const ROUTES = { '#/city': CityScreen, '#/my': MyScreen }`。
4. 页面多了就换成 `vue-router`。

### 6.7 嵌入已有后台系统

1. 把 `src/kit/` 整个文件夹拷过去（只做 2D 就去掉 `kit/3d/`），`kit/core/theme.css` 全局引入一次。
   组件库内部通过 `@` → `src` 别名互相引用。
2. 给大屏一个铺满视口的容器：`.my-screen { position: fixed; inset: 0; z-index: 3000; }`
3. 路由使用空白布局。后台框架常给页面根节点加 `height: calc(100% - 60px)`、内边距或 overflow，会导致大屏被裁切。

详见 [模板 README](../templates/vue3-echarts/README.md)。

## 7. 3D 数字孪生城市

打开 `/#/city`。中间是用代码实时生成的 three.js 场景：不依赖模型和贴图，离线可用。

### 7.1 操作方式

| 操作 | 鼠标 / 触控 |
|---|---|
| 旋转 | 左键拖拽 |
| 平移 | 右键拖拽、中键拖拽，或 Shift + 左键拖拽 |
| 缩放 | 滚轮 |
| 飞到告警点 | 点击地图上的光柱，或左侧告警列表中的一行 |
| 恢复巡航 | 放着不动：约 12 秒无操作后，镜头平滑回到自动巡航 |

飞过去之后镜头会在告警点停留约 8 秒，再回到巡航。缩放和俯仰角都有限位，不会钻到地下或丢失城市。

### 7.2 在需求文件里开启

```yaml
hero:
  mode: three      # image（默认）| three
  scene: city      # 目前只有 city
  seed: 7          # 种子相同 → 城市布局相同
```

和 AI 对话时，在需求里加一句"3D 城市"或"数字孪生"即可。设计稿提示词会改为描述 3D 城市，切图清单也会跳过主视觉图。

### 7.3 在自己的页面里使用

```vue
<CityHero
  ref="city"
  :alerts="alerts"
  :focus-id="focusId"
  :seed="7"
  :fallback="fallbackImage"
  @select="(id) => (focusId = id)"
/>
```

`alerts` 每一项是 `{ id, label, level: 'info' | 'warn' | 'critical', x, z, value?, unit? }`，
`x`、`z` 是 -1 到 1 的地图坐标。代码里调用 `city.value.flyTo(id)` 可以移动镜头。

内置保护：使用 WebGL2；像素比上限为 2；页面隐藏时暂停渲染；减弱动效时只渲染一帧静态画面；
卸载时释放所有资源；WebGL 失败时显示 `fallback` 图片。更多见 [guide-3d.md](guide-3d.md)。

## 8. 构建与部署

```bash
npm run build      # 输出到 dist/
```

构建使用相对路径（`./`），`dist/` 放在任意子路径、共享目录或普通静态服务器（Nginx、IIS、S3、内网机器）都能运行。
模拟 JSON 会被复制到 `dist/mock/`，接上真实接口后可以删掉。

- **GitHub Pages。** `.github/workflows/pages.yml` 会在每次推送到 `main` 且改动了模板时自动发布。
  首次需要在 *Settings → Pages → Source* 里选择 *GitHub Actions*。
- **大屏上墙。** 用浏览器 kiosk 模式打开，例如 `chrome --kiosk --app=https://your-host/screen/`。
  CSS `zoom` 需要 Chromium、Safari 或 Firefox 126+。
- **安全。** 模板是纯静态前端，不带登录鉴权。数据敏感的话，请放在 SSO 或反向代理鉴权之后，并保护好它调用的接口。

## 9. 常见问题排查

| 现象 | 解决办法 |
|---|---|
| `npm install` 失败或 Vite 起不来 | 检查 `node -v` 是否为 20.19+ |
| 5173 端口打开的是别的项目 | 端口被其他开发服务器占用。用 Vite 打印的地址，或 `npm run dev -- --port 5180` |
| 提示 `BIGVIZ_API_KEY is not set` | 在运行 CLI 或 AI 助手的同一个终端里设置环境变量 |
| 设计稿分辨率小于 1920×1080 | 正常：接口有分辨率上限。`bigviz probe` 会记录实际尺寸；文字由代码渲染，素材会高清重绘 |
| 设计稿里的字是乱的 | 把易错文字写进 `pitfalls`，批量 `--n 4`–`7` 张挑最准的，再做一次 `prompt fix` + `edit` |
| 抠图后素材有光晕或黑边 | 黑底物体试试 `--method black`，调整 `--gain` / `--feather`；见 [guide-matting.md](guide-matting.md) |
| `bigviz shot` 提示缺少 Playwright 或 Chromium | 安装 `shot` 扩展并运行 `playwright install chromium`（见 [3.2](#32-安装-cli)） |
| 3D 截图是空白的 | 无头浏览器渲染 WebGL 较慢，加 `--wait 6000` 或更长 |
| 面板报错并显示字段路径 | 接口结构和模拟数据不一致，修改接口返回或 `src/api/` 里的校验函数 |
| 嵌入后台后大屏被裁切或少 60 px | 宿主布局样式影响了大屏，见 [6.7](#67-嵌入已有后台系统) |
| 3D 城市显示成静态图片 | WebGL 不可用（显卡驱动老旧、远程桌面），这是降级机制在生效 |

还解决不了？加 `-v` 重新运行，然后提 Issue，附上命令、输出和 `bigviz doctor` 结果（先删掉日志里的 Key）。

## 10. 参与开发 BigViz

```bash
# CLI
cd cli
uv sync
uv run pytest

# 模板
cd templates/vue3-echarts
npm ci
npm run typecheck
npm run build
```

贡献规范见 [CONTRIBUTING.md](../CONTRIBUTING.md)：Conventional Commits 提交信息、一个 PR 只做一件事、
CLI 改动要带测试、界面改动要带截图、只接受原创内容。CLI、模板、技能之间的约定见 [ARCHITECTURE.md](ARCHITECTURE.md)，
改了其中一处，要在同一个 PR 里同步所有使用方。
