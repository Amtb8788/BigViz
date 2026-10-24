# 提示词库

三部分：A 用户描述场景的模板与填好的示例；B 写实资产生成提示词（image-to-3D、PBR 贴图）；C 技能内部各阶段提示词。所有数量写具体数字，所有尺寸写米。

## A. 场景描述模板（用户 → Agent）

### A.0 通用模板

```
【场景类型】智慧工地 / 智慧工厂 / 智慧园区 / 城市街道
【范围与尺度】占地 __ m × __ m；地理位置（可选）：城市/经纬度；周边：几条路、什么建筑
【渲染档】写实 T2（无桌面、无移轴）/ 基础 T1 / 2D；目标硬件：集显笔记本 / 独显 / 大屏工控机
【时间】日期与季节；起止时刻；是否昼夜循环；时间流速（如 1 秒 = 1 分钟）
【天气】晴/阴/小雨/大雨/雪/雾；风力；地面状态（干/湿/积水/积雪）
【镜头】列出 4–8 个机位：名称、位置描述、高度、俯角、焦距感（广角/标准/长焦）、是否运动
【主体建筑/设施】数量、层数、层高、当前施工/运行状态
【机械设备】逐台：类型、型号/吨位、数量、位置、作业内容、作业时段
【车辆】类型 × 数量；进出口；路线；高峰时段密度（辆/小时）
【人员】工种/角色 × 数量；PPE 颜色规范；活动区域；班次
【材料堆场】材料类型、堆放形式、尺寸、数量、位置
【标识标牌】安全标语、限速、指示牌、五牌一图、广告牌：内容与位置
【道路与路口】车道数、红绿灯路口数量、相位（周期秒数）、斑马线、公交站
【IoT 设备】逐类：设备类型 × 数量、挂在哪个组件上、上报字段与频率、告警阈值
【业务系统】需要接入的系统（工单、进度、视频、门禁、能耗）及接口形式
【必须避免】例如：卡通、玩具感、纯色方块、夸张比例、桌面沙盘
```

### A.1 示例：写实智慧工地

```
【场景类型】智慧工地，住宅项目 2# 楼主体施工阶段
【范围与尺度】场地 120 m × 90 m，北侧临 6 车道城市主干道（双向，中央绿化带 3 m），东侧临 2 车道支路；东北角为信号灯十字路口。周边：西侧 6 层老旧住宅，南侧在建地块（只有围挡）。
【渲染档】写实 T2，无桌面无移轴；目标：集显笔记本 1080p ≥ 30fps，大屏工控机（RTX 3060）4K ≥ 30fps。
【时间】11 月初，14:30 开始，昼夜循环，1 秒 = 2 分钟；重点时段 16:30–17:30 黄昏与亮灯。
【天气】阴天转小雨，偏北风 3–4 级，雨后地面湿润、有小面积积水反光，塔吊顶部风速仪读数随风波动。
【镜头】
 1. 总览：场地东南 45°，高 80 m，俯角 35°，标准焦距，缓慢环绕 60 秒一圈
 2. 塔吊驾驶视角：1# 塔吊驾驶室，向下看吊钩与作业面
 3. 大门：门口 6 m 高，看车辆冲洗台与闸机
 4. 路口：主干道路口人行道 1.6 m 视高，看红绿灯与过街行人
 5. 钢筋加工棚：棚内 3 m 高，看工人弯箍与切断机
 6. 楼层内部：2# 楼 9 层作业面，第一人称
【主体建筑】2# 楼 18 层剪力墙结构，层高 2.9 m，当前施工至 11 层，9–11 层外挂爬架（附着式升降脚手架，绿色密目网），1–8 层已拆模、外墙未施工；1# 楼已封顶，正在外立面施工（吊篮 4 台）。
【机械设备】
 - 塔吊 QTZ80（TC6013）×2：1# 高 62 m、臂长 60 m；2# 高 55 m、臂长 55 m；两塔有交叉作业区，需防碰撞；黄色涂装、标准节带红白警示
 - 施工电梯 SC200/200 双笼 ×1，附着 2# 楼东侧
 - 混凝土泵车 56 m 臂架 ×1，下午 15:00–18:00 浇筑 11 层顶板
 - 混凝土搅拌运输车 12 m³ ×6，循环进出，间隔约 12 分钟
 - 挖掘机 20 t ×1，停放在南侧，不作业
 - 叉车 3 t ×1，钢筋棚与材料堆场之间转运
 - 雾炮机 ×2，围挡内侧，PM10 超标自动开启
【车辆】搅拌车 6 辆循环；渣土车 0；材料车（平板车运钢筋）×1 于 15:30 进场卸货；主干道社会车辆高峰 800 辆/小时/方向，支路 120 辆/小时；公交车每 6 分钟一班，北侧有港湾式公交站。
【人员】现场工人 46 人：钢筋工 14、木工 12、混凝土工 8、架子工 4、电工 2、信号工 2（橙色反光背心）、塔吊司机 2、安全员 2；均戴安全帽：管理人员白色、技术人员蓝色、工人黄色、安全员红色，穿反光背心与劳保鞋。路口行人每相位 5–15 人，含骑电动车外卖员。
【材料堆场】钢筋堆场 20 m × 8 m（Φ12–Φ25 螺纹钢，按规格挂牌，垫木架空 0.3 m）；模板木方堆 10 m × 6 m；铝模周转区；砌块托盘 30 个；砂石料仓 3 格（混凝土隔墙）；废料池 1 个。
【标识标牌】大门“五牌一图”；门楼项目名“XX 置业 · 2# 楼”；围挡蓝白公益广告；限速 5 km/h 牌；“安全第一 预防为主”横幅挂在 2# 楼 8 层；路口有电子警察杆与限速 50 标志。
【道路与路口】东北角十字路口：主干道双向 6 车道 + 左转专用道；4 相位，周期 120 s（南北直行 40 s / 南北左转 20 s / 东西直行 30 s / 东西左转 15 s，黄灯 3 s，全红 2 s）；四向斑马线，行人信号倒计时。
【IoT 设备】
 - 塔吊安全监控 ×2：挂驾驶室，上报载重、力矩百分比、回转角、幅度、高度、风速，1 Hz；力矩 ≥ 90% 预警、≥ 100% 告警，风速 ≥ 20 m/s 告警
 - 升降机监控 ×1：挂吊笼，载重、楼层、门锁状态
 - 扬尘噪声监测站 ×2：大门与西南角，PM2.5/PM10/噪声/温湿度/风速，1 分钟；PM10 ≥ 150 μg/m³ 告警联动雾炮
 - 高支模监测 ×1：挂 11 层顶板，沉降/倾角/轴力
 - 深基坑监测：本阶段不需要
 - 视频 ×8：大门 2、塔吊吊钩 2、钢筋棚 1、作业面 2、路口 1
 - 智能电表 ×3：总配电箱、钢筋棚、生活区
 - 人员定位：工人安全帽 UWB 标签 46 个，5 s 刷新
 - 信号机 ×1：路口，相位状态推送
【业务系统】进度计划（P6 导出，按楼层）、隐患整改工单、视频平台（GB28181 转 WebRTC）、实名制门禁闸机。
【必须避免】卡通、玩具感、纯色方块、桌面沙盘、移轴微缩效果、过饱和色、所有人同步动作、车辆穿插、悬浮物体。
```

### A.2 示例：写实智慧工厂

```
【场景类型】智慧工厂，汽车零部件冲压 + 焊装车间
【范围与尺度】厂房 180 m × 72 m，单层钢结构，檐高 14 m，屋面采光带；厂区含原料库 40 m × 30 m、成品库、动力站、厂区道路环线 7 m 宽、两个出入口。
【渲染档】写实 T2；支持厂房屋顶剖切（进入室内时屋面与东墙自动隐藏）。
【时间】工作日 07:45 早班交接起，持续 4 小时；1 秒 = 10 秒。
【天气】晴，室内为主：LED 高棚灯 5000 K，地面环氧地坪浅灰带反光，黄色通道线 + 绿色人行道线。
【镜头】厂区鸟瞰；冲压线侧面 1.6 m；焊装线机器人特写；AGV 通道跟随；中控室屏幕墙；成品库高位货架巷道。
【设备】冲压线 1 条（2500 t 首压 + 4 台 800 t 后续压机 + 端拾器 + 线尾码垛）；焊装线 2 条，每条 8 台六轴机器人（橙色工业机器人，带焊枪与防护围栏、光栅）；AGV 潜伏式 ×12（任务驱动，充电桩 4 个）；叉车 ×4；桥式起重机 20 t ×2（行走轨道在柱牛腿上）；空压机 ×3（动力站）；冷却塔 ×2。
【人员】操作工 36、班组长 4、质检 6、维修 3；深蓝工服、白色安全帽（管理）/黄色（操作），耳塞、防砸鞋；焊装区护目镜。
【物料】钢卷 20 卷（直径 1.8 m，立放于卷座）；料箱 300 个（蓝色塑料周转箱）；成品料架 60 个；高位货架 8 排 × 6 层。
【标识】地面通道线、限高、“当心机械伤人”、安灯（Andon）看板、每台设备铭牌与二维码。
【IoT 设备】压机：吨位、冲次（SPM）、模具温度、振动 RMS（挂压机曲轴箱）；机器人：状态、节拍、焊接电流、故障码；AGV：位置、电量、任务号；空压机：压力、流量、电流；电表：每条线一块；冷却塔：进出水温；温湿度：车间 6 点。告警：振动 RMS ≥ 7.1 mm/s、电量 ≤ 20%、压力 ≤ 0.55 MPa。
【业务系统】MES（工单、节拍、OEE）、WMS（库位）、CMMS（维修工单）、能耗平台。
【必须避免】玩具感机器人、无防护围栏、AGV 穿人、所有设备同步动作。
```

### A.3 示例：写实智慧园区

```
【场景类型】智慧园区，科技产业园，占地 600 m × 420 m
【内容】办公楼 6 栋（12–24 层玻璃幕墙）、研发楼 2 栋、食堂、人才公寓 3 栋、地下车库入口 3 个、中央景观湖（喷泉）、环湖步道、园区主路 2 车道 + 自行车道、园区大门 2 个（车牌识别道闸）。
【时间/天气】5 月工作日 08:00–09:30 上班高峰，晴转多云；19:30 夜景（幕墙泛光、路灯、景观灯带）。
【人车】早高峰入园车辆 1200 辆/小时，共享单车 200 辆停放点 6 处，行人 3000 人分布在楼宇入口与地铁口步道；外卖电动车 30 辆。
【IoT】道闸 ×4、车位地磁 ×1800（聚合显示为车库占用率）、智慧路灯 ×120（带摄像头、环境传感、广播）、梯控 ×48、楼宇能耗表 ×11、消防烟感按楼层聚合、井盖位移 ×60、水质监测 ×2（湖）。
【室内】A1 栋可进入：大堂、3 层办公、屋顶设备层（冷机、水泵）；楼层隔离 + 房间导航。
【业务】访客预约、停车缴费、能耗、物业工单、安防视频。
【必须避免】玩具楼体、无窗纯色块、全部同色车辆、静止人群。
```

### A.4 示例：写实城市街道路口

```
【场景类型】城市街道，双主干道十字路口 + 两侧沿街商业
【尺度】东西向 8 车道（含 2 左转 + 1 公交专用），南北向 6 车道；路口 60 m × 50 m；沿街 3–5 层商业楼，底商招牌与雨棚。
【时间/天气】冬季 17:40–18:30 晚高峰，傍晚转夜，小雨，路面湿反光，车灯与尾灯在湿地面拉出倒影。
【信号】6 相位，周期 150 s，含左转保护相位、行人二次过街（中央安全岛）、公交优先（公交到达前 10 s 延长绿灯）；倒计时屏；非机动车道独立信号。
【交通】机动车 2400 辆/小时（私家车 75%、出租 10%、网约车 8%、公交 4%、货车 3%）；电动自行车 600 辆/小时；行人每相位 20–40 人，雨伞；车辆颜色真实分布（白 35%、黑 25%、灰银 20%、其他 20%）。
【街道设施】信号灯悬臂杆、电子警察、诱导屏、公交站亭、隔离护栏、行道树（冬季落叶悬铃木）、垃圾桶、消防栓、路名牌、共享单车停放区、井盖、雨水口、交通锥。
【IoT】信号机 ×1（相位）、地磁/线圈 ×24（每车道排队长度）、雷视一体机 ×4、智慧灯杆 ×10（环境 + 广播）、路面积水监测 ×2；告警：排队 ≥ 150 m、积水 ≥ 15 cm。
【镜头】路口斜上方 25 m 总览；东进口司机视角；行人等候区视角；公交站视角；俯视 90° 交通流。
【必须避免】车辆同速列队、闯红灯、穿模、行人走在机动车道、卡通配色。
```

### A.5 示例：写实智慧隧道施工（山岭隧道钻爆法）

```
【场景类型】智慧工地，双线铁路/高速公路山岭隧道进口段，钻爆法 + 新奥法（台阶法开挖）
【范围与尺度】洞口场地 140 m × 100 m；隧道左右两洞，净宽 12.5 m、净高 9 m，马蹄形断面，两洞中心距 35 m；山体剖切展示洞内 0–180 m；洞外：拌合站、钢筋加工厂、弃渣场、空压机房、高压风水管、变电站、项目部板房、洗车台、门禁闸机。
【渲染档】写实 T2；山体可剖切（俯视时山体半透明 / 切除，露出洞内工序）。
【时间】9 月，三班倒 24 h 不停工，1 秒 = 2 分钟；重点：一个完整循环（钻孔 3 h → 装药 1 h → 爆破通风 0.5 h → 出渣 3 h → 初支 3 h），夜间洞口灯塔。
【天气】晴，洞内粉尘与水雾、灯带照明，洞口潮湿泥泞。
【镜头】
 1. 总览：洞口东南 45°，高 70 m，看两洞口、山体、场地
 2. 掌子面：洞内 30 m，高 4 m，看三臂凿岩台车钻孔
 3. 出渣：跟随自卸车从掌子面驶出洞口到弃渣场
 4. 二衬台车：洞内 120 m，看 12 m 模板台车与泵送混凝土
 5. 洞口：门禁与人员定位闸机，1.6 m 视高
 6. 剖切俯视：山体剖开，纵向看全部工序分布
【主体结构】洞门（削竹式 / 端墙式）+ 明洞 15 m；洞内分区：掌子面 → 上台阶/下台阶（0–30 m）→ 仰拱栈桥（40–60 m）→ 防水板台车（80 m）→ 二衬台车（110–122 m）→ 已完成二衬段（光洁灰色）；初支段可见钢拱架、锚杆头、喷混凝土粗糙面。
【机械设备】三臂凿岩台车 ×1、湿喷机械手 ×1、拱架安装台车 ×1、侧卸装载机 ×1、挖掘机 ×1、20 t 自卸车 ×4（循环出渣）、仰拱栈桥 24 m ×1、防水板台车 ×1、二衬模板台车 12 m ×1、混凝土罐车 ×3、混凝土输送泵 ×1、射流风机 / 通风管 φ1.8 m（黄色软风管沿拱顶）、空压机 ×4、门架式洞口龙门吊 ×1。
【人员】洞内作业 38 人：钻工 8、喷混 4、拱架 6、出渣司机 6、衬砌 8、电工 2、安全员 2、值班领工 2；橙色反光工服、黄色安全帽带头灯、自救器；人员 UWB 定位卡。
【标识】洞口“进洞须知”“安全步距”公示牌、里程桩号牌（DK123+450）、逃生管道（橙色 φ800）、应急照明、限速 15 km/h。
【IoT】有害气体监测 ×4（CH4/CO/H2S/O2，掌子面与二衬处）、人员定位基站 ×12、通风机变频器 ×2（风量/电流）、围岩监控量测（拱顶沉降、周边收敛）×6 断面、二衬台车压力传感器 ×8、视频 ×10、门禁 ×2、爆破振动监测 ×2。告警：CH4 ≥ 0.5%、CO ≥ 24 ppm、O2 ≤ 19.5%、拱顶沉降速率 ≥ 5 mm/d、安全步距超限（二衬距掌子面 > 90 m）。
【业务系统】工序循环记录、超前地质预报、监控量测、人员定位、视频、门禁。
【必须避免】卡通、洞内全黑或均匀亮、隧道断面变成矩形、车辆在洞内穿模、机械悬空、所有工序同时停顿。
```

### A.6 示例：写实智慧桥梁施工（跨江连续刚构 + 引桥架桥）

```
【场景类型】智慧工地，跨江大桥：主桥（80 + 140 + 80）m 预应力混凝土连续刚构，挂篮悬臂浇筑；北引桥 30 m 简支 T 梁，架桥机架设
【范围与尺度】场景 360 m × 160 m；江面宽 260 m，两岸滩地 + 防洪堤；主墩 2 个（双薄壁墩，高 42 m），过渡墩 2 个，引桥墩 6 个（高 12–18 m）；桥宽 2 × 16.5 m 分幅。
【渲染档】写实 T2；江面为反射水面（流动法线 + 岸边泡沫），可水下剖切看钢围堰与桩基。
【时间】4 月，06:00–20:00，1 秒 = 3 分钟；施工进度按天推进：主墩 0# 块完成 → 挂篮逐段浇筑至 9# 块 → 边跨合龙；引桥每天架设 2 片 T 梁。
【天气】多云，江面薄雾，偏东风 4 级；风速超 6 级时挂篮与架桥机停工。
【镜头】
 1. 总览：下游侧 45°，高 90 m，看全桥
 2. 挂篮：主墩悬臂端，高 45 m，看挂篮行走与浇筑
 3. 架桥机：引桥桥面，看运梁车喂梁、天车吊梁、落梁
 4. 江面：船视角 2 m 高，看主墩、浮吊与运输船
 5. 桥下：滩地 1.6 m 视高，看墩身爬模与塔吊
 6. 俯视 90°：桥位轴线与航道
【主体结构】主墩：钢板桩围堰 + 承台 + 双肢薄壁墩（爬模）；0# 块托架；悬臂节段 3–4.5 m 一段，每端 9 段，梁高由墩顶 8.5 m 渐变至跨中 3.2 m；引桥 T 梁 30 m、梁高 2 m。
【机械设备】菱形挂篮 ×4（每主墩两端各 1，红色桁架）、塔吊 ×2（主墩旁）、浮吊 200 t ×1、运输驳船 ×2、交通船 ×1、架桥机 JQ900 / 180 t 双导梁 ×1、运梁车 ×1（轮胎式）、梁场龙门吊 ×2、混凝土罐车 ×3、天泵 ×1、汽车吊 ×1、液压爬模 ×4 套。
【车辆与船】罐车循环至主墩栈桥；江面货船按航道往返，每 4 分钟一艘，航道浮标 6 个；栈桥 6 m 宽钢栈桥连接北岸到主墩。
【人员】桥面与挂篮 32 人：钢筋 10、模板 8、混凝土 6、张拉 4、测量 2、安全员 2；安全带挂点、救生衣（江上）、橙色工服。
【IoT】桥梁线形监测（标高、轴线）×每段、挂篮应力 ×8、主墩倾斜 ×2、索力/预应力张拉记录、架桥机安全监控（载荷、风速、行程、限位）、塔吊监控 ×2、水位计 ×1、风速仪 ×3、视频 ×12、船舶 AIS 接入。告警：风速 ≥ 13.8 m/s（6 级）、挂篮应力 ≥ 85% 设计值、线形偏差 ≥ 20 mm、水位超警戒。
【业务系统】节段施工台账、线形监控、梁场生产、架梁记录、航道管理。
【必须避免】卡通、桥墩比例失真、梁体悬空无支撑、水面静止无反射、船只穿桥墩、挂篮与梁端脱开。
```

## B. 写实资产生成提示词

### B.0 通用约束（所有资产都附加）

流程：先用图像模型生成“正交参考图”（单体、纯色背景、正面/侧面/3/4 视角），再喂给 image-to-3D（Tripo / Meshy / Rodin / Hunyuan3D 等），最后人工清理拓扑并按 `architecture.md` §3 规范化。细长桁架与可动关节类（塔吊、泵车臂架、挖掘机斗杆）的生成结果只能当参考或远景 LOD，近景请采购或手工建模。

正向风格后缀（英文，图像模型对英文更稳定）：

```
photorealistic product reference photo, real-world scale, accurate proportions, physically based materials,
single object centered, full object in frame, neutral studio lighting, soft shadow, plain light grey seamless background,
orthographic-like 50mm lens, high detail, worn and used surfaces, subtle dirt and scratches, 8k, sharp focus
```

通用负向提示词：

```
cartoon, toy, low poly, stylized, chibi, miniature, tilt-shift, diorama, clay render, plastic toy look, cel shading,
oversaturated, neon, exaggerated proportions, big head, cute, game asset flat colours, blurry, depth of field,
multiple objects, cropped, cut off, text, watermark, logo, background clutter, people (unless requested), fisheye
```

### B.1 机械与车辆（参考图 → 3D）

挖掘机：
```
A 20-tonne hydraulic crawler excavator, Caterpillar 320 / Sany SY215 class, yellow paint with black counterweight,
steel tracks with mud, boom and stick extended forward, bucket resting on ground, cab glass with reflections,
hydraulic hoses visible, faded decals without readable text, 3/4 front view, length about 9.5 m, height 3 m
```

塔吊（仅作参考与远景 LOD）：
```
Tower crane TC6013 flat-top, yellow lattice mast sections 1.8 m square, red-white warning stripes on mast base,
60 m jib with trolley and hook block, concrete counterweight blocks on counter jib, operator cab below slewing unit,
anemometer on top, full height 60 m, side elevation, thin steel lattice clearly readable
```

混凝土搅拌运输车：
```
12 cubic metre concrete mixer truck, 8x4 chassis, white cab, orange and grey striped rotating drum with concrete
splashes, chute folded at rear, mud on wheels and lower body, side view and 3/4 rear view, length 10 m, height 3.9 m
```

混凝土泵车、渣土车、叉车、平板车同理：写“吨位/型号级别 + 主色 + 关键结构件 + 磨损 + 尺寸 + 视角”。

隧道装备：
```
Three-boom computerised tunnel drilling jumbo, Sandvik DT1132i / Epiroc Boomer XE3 class, yellow carrier with
red booms, three hydraulic drill feeds extended forward, operator canopy, cable reel at rear, wet rock dust and mud,
3/4 front view, length 17 m, width 3 m, height 3.8 m
```
```
Tunnel second lining formwork jumbo, 12 m long steel gantry with horseshoe-shaped arched formwork shell,
hydraulic jacks and screw props, concrete windows, walkway platforms, rails underneath, used concrete stains,
cross-section view and 3/4 view, arch span 12.5 m, height 9 m
```
同类：湿喷机械手（`shotcrete spraying manipulator truck, telescopic boom with nozzle, concrete overspray`）、仰拱栈桥（`24 m steel inverted-arch trestle bridge with hydraulic ramps over tunnel invert excavation`）、黄色通风软管（`1.8 m diameter yellow flexible ventilation duct hanging along tunnel crown, sagging between hooks`）、钢拱架（`I-beam steel arch ribs HW200 spaced 0.6 m, wire mesh, rock bolts, rough sprayed concrete`）。

桥梁装备：
```
Rhombic form traveller for balanced cantilever bridge construction, red painted steel truss frame with diamond-shaped
main trusses, front and rear cross beams, suspension rods, bottom formwork platform, safety railings and green mesh,
attached to the end of a concrete box-girder segment, side view, length 15 m, height 7 m
```
```
Bridge girder launching machine 180 t double-girder type, two long yellow box girders 70 m, two overhead lifting
trolleys, front and middle support legs, holding a precast concrete T-beam 30 m, on top of a viaduct, side view
```
同类：浮吊（`200 t floating crane barge, lattice boom, river water`）、钢板桩围堰（`steel sheet pile cofferdam ring in river, inner bracing frames`）、液压爬模（`hydraulic climbing formwork on tall bridge pier, multi-level platforms with safety mesh`）、运梁车（`tyred girder transporter, multi-axle, carrying concrete T-beam`）。

### B.2 材料

钢筋捆：
```
Bundle of 40 deformed steel rebars, 12 m long, 25 mm diameter, ribbed surface, light surface rust orange-brown,
tied with black wire at three points, resting on two timber sleepers, metal tag label (blank), close 3/4 view
```

其他材料提示词要点：模板木方（`stack of 4x8 ft film-faced plywood, brown phenolic face, chipped edges, on pallets`）、砌块托盘（`pallet of grey AAC blocks wrapped in torn clear stretch film`）、水泥罐（`vertical cement silo 100 t, white steel, ladder cage, dust stains`）、钢卷（`hot rolled steel coil 1.8 m diameter standing on coil saddle, blue-grey mill scale`）、塑料周转箱（`blue industrial plastic tote bin 600x400x280 mm, scuffed`）。

### B.3 人物（PPE）

```
Full-body photo of a Chinese construction worker standing in A-pose for 3D scanning reference,
yellow ABS hard hat with chin strap, high-visibility orange vest with silver reflective stripes over navy work jacket,
dark work trousers with knee pads, steel-toe boots dusty, cotton gloves, realistic adult proportions height 1.75 m,
front view and side view, neutral expression, plain background
```

变体：信号工（橙色背心 + 对讲机 + 口哨）、安全员（红色安全帽 + 红袖标）、管理人员（白色安全帽 + 蓝色马甲 + 文件夹）、焊工（面罩 + 皮围裙）、工厂操作工（深蓝工服 + 耳塞 + 护目镜）。人物用于 image-to-3D 后必须重拓扑 + 绑定骨骼（Mixamo 或自有动作库），否则只能做远景静态。

### B.4 交通信号与街道设施

```
Chinese urban traffic signal mast arm pole, galvanised grey steel octagonal pole 6.5 m, horizontal arm 8 m,
three vehicle signal heads (red amber green, round LED, black housing with visors) plus left-arrow head and
countdown display, side-mounted pedestrian signal, street name sign blank, base plate with bolts, side elevation
```

街道设施清单（同格式）：LED 路灯（双臂 10 m）、智慧灯杆（含摄像头、环境传感器、屏幕）、公交站亭（玻璃顶 + 广告灯箱空白）、隔离护栏（白色金属 + 红黄反光）、悬铃木行道树（冬季落叶 / 夏季）、垃圾分类桶、消防栓、交通锥与水马、电子警察 F 杆、诱导屏。

### B.5 PBR 贴图提示词（无缝平铺）

所有贴图提示词附加：`seamless tileable texture, top-down orthographic, flat even lighting, no shadows, no perspective, physically based albedo, 4k`；负向附加：`perspective, vignette, shadows, highlights, objects, text`。生成 albedo 后用 Materialize / Substance Sampler 推导 normal / roughness / AO，或直接生成对应通道。

| 材质 | 提示词主体 |
|---|---|
| 沥青（湿） | `asphalt road surface, fine aggregate, slightly worn, dark grey, wet patches` |
| 混凝土地面 | `poured concrete slab, trowel marks, hairline cracks, light grey, cement dust` |
| 工地泥土 | `compacted brown construction site soil, tyre tracks, small gravel, puddle edges` |
| 碎石 | `crushed grey limestone gravel 20-40 mm` |
| 环氧地坪 | `light grey epoxy factory floor, subtle scuffs, faint reflections removed` |
| 人行道砖 | `Chinese sidewalk paving, 300x300 grey granite tiles with yellow tactile strip` |
| 斑马线磨损 | `white thermoplastic road marking on asphalt, worn and cracked` |
| 密目安全网 | `green construction scaffold safety mesh, dense weave, semi transparent` |
| 镀锌钢 | `hot-dip galvanised steel, spangle pattern, light oxidation` |
| 黄色机械漆 | `industrial yellow machine paint, chipped edges, oil stains, dust` |

## C. 技能内部提示词

每段是技能给模型自身（或子 Agent）的系统级指令，`{}` 为运行时填充。

### C.1 twin-brief：访谈与规格

```
你在为数字孪生场景写规格 twin.yaml。用户输入：{user_text}；附件：{attachments}。
1. 用 A.0 模板的 16 个栏目逐项核对，缺项列成问题清单，一次最多问 6 个，优先问会影响布局与资产的问题（尺度、主体建筑、机械清单、路口）。
2. 所有数量、尺寸、时段必须是具体数字；用户说“几台/一些”时给出建议值并标注 assumed: true。
3. 为每个实体分配稳定 id（kebab-case，带类型前缀：tc-01、mixer-03、dev-env-gate），后续阶段只读。
4. 输出：twin.yaml 全文 + “假设清单” + “需用户确认的 3 个关键决策”（渲染档/目标硬件、资产来源、是否接真实数据）。
不要开始布局，不要编造用户未提及的业务系统接口地址。
```

### C.2 twin-scene：布局

```
输入 twin.yaml：{spec}。产出 scene.json 的 board/terrain/ground/roads/intersections/places/entities(静态)。
坐标：米制，+x 东，+z 南，原点为场地中心。约束：
- 车道宽 3.5 m（工地便道 6–7 m），人行道 ≥ 2.5 m，塔吊与建筑净距 ≥ 2 m，两塔交叉区需在 intersections 外标注。
- 路网 nodes/edges：每条边给 lanes、speed、class；所有车辆出入口有 off-board 节点（参照现有 offE/offW）。
- 每个 entities 项给 asset.ref 与 asset.fallback（现有 PREFABS 名：worker, mixer, dumpTruck, flatbed, car, forklift, excavator, mobileCrane, pumpTruck, towerCrane, hoist, building, tree, shrub, fence, stockPile, heap 等）。
- 实体落在 board 内、不压路、不互相重叠（包围盒检查）。
完成后运行 validate-scene，修复全部 error 再输出；附俯视截图路径。
```

### C.3 twin-scene：仿真

```
输入 scene.json（布局已锁定）与 twin.yaml 的作业描述。为每台机械/车辆/人员写 agent.plans：
- 每个 plan 有 when（day/hour/weather/var/signal）与 steps，只用已注册 step（systems/steps-move.js、steps-work.js）：walk, drive, reverse, path, face, teleport, wander, wait, anim, tween, crane, ride, carry, tool, work, waitFor, waitVar, lock, unlock, set, add, signal, clear, emit, fx, log, say, show, hide；结构用 repeat / choose；call 仅在 hooks 中以名字引用。
- 协同用 lock/signal/var（如 'truck.atDig'、'stock.rebar'），不要用时间硬凑同步。
- 加入随机：wait 用区间 [a,b]，同类智能体用 stagger，避免同步动作。
- 信号路口：车辆在停止线前 waitVar 'sig.<id>.<approach>' == 'green'。
- 函数只能写在 scene.hooks.js 并以名字引用。
输出 diff 形式的 scene.json 修改，并列出每个 plan 的一句话说明。
```

### C.4 twin-assets：资产清单与采购/生成

```
输入：scene.json 中全部 asset.ref、twin.yaml 的写实要求与目标硬件。
对每个 ref 决定来源：existing（注册表已有）> buy/open（给出 2 个候选来源与许可证）> generate（B 节提示词）> procedural（仅远景或兜底）。
对 generate：先输出参考图提示词（正向 + B.0 后缀 + 负向），再输出 image-to-3D 参数（目标面数、是否 PBR、四边面）。
对每个资产写注册表条目：尺寸 bbox（米）、rig 节点映射（与现有动画器一致：slew/boom/arm/bucket/trolley/hook 等）、LOD 面数预算、KTX2 纹理尺寸。
不可达成写实的项（例如生成的塔吊桁架破面）必须标注 status: needs-manual，不要假装完成。
```

### C.5 twin-iot：设备与绑定

```
输入：twin.yaml 的 IoT 清单、样例报文 {samples}、scene.json 实体列表。
1. 为每类设备写设备模型（points: path/unit/range，默认告警阈值）。
2. 为每个设备写实例：attachTo.entity + anchor（命名锚点 / glTF 节点 / 局部坐标），topic，protocol。
3. 为每个需要可视化的点位写 binding：target.prop、transform、visual 规则（只用 tint/emissive/pulse/beacon/label/gauge/flow/rotate/drive/visible/heat），when 表达式只用 v/prev/dt 与比较逻辑。
4. 写 mock 剧本：正常 60 s → 预警 20 s → 告警 20 s → 恢复，覆盖每条告警规则。
5. 凭据一律用占位 ${ENV_NAME}，不得写入真实密钥或内网地址。
```

### C.6 twin-qa：验收

```
输入：构建产物、scene.json、bindings.json、verify 报告 {report}、截图目录 {shots}。
逐项判定 agent-design.md §5 检查清单，每项给 PASS/FAIL + 证据（截图文件名或 report 字段）。
重点看图：是否仍有纯色盒子主体、比例是否失真（以工人 1.75 m 为尺）、物体是否悬空/穿模、湿地面与夜景是否成立、标签是否遮挡主体。
FPS 判定必须引用 report.renderer；若为 SwiftShader/软件渲染，FPS 项记为 N/A 而不是 PASS。
FAIL 项给出回流目标（scene / assets / iot）与具体修改建议。
```

### C.7 编排器：入口与关卡

```
检查工作区 twin/<slug>/：存在哪些文件、twin.yaml#status。按 agent-design.md §2 入口判断选择阶段。
每阶段结束：展示产物路径 + 1–3 张证据截图 + 下一步选项，等待用户确认再继续。
资产与仿真可并行；同一文件只允许一个子 Agent 写。
用户要大屏外壳时，调用 BigViz 编排器并把 twin.yaml 路径写入 bigviz.yaml#hero.twin。
```

