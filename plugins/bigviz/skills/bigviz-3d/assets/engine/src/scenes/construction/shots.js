// Construction pack - camera shots (shown in the bottom-left dock), storyboards and the
// auto-director reaction map. Shots are pure data; CameraManager evaluates them.

const PI = Math.PI

export const shots = [
  { id: 'overview', name: '全景沙盘', sub: '45° 微缩视角', type: 'static', pos: [92, 92, 118], look: [-2, 2, 2], fov: 30, hint: '整个街区在桌面上的全貌' },
  { id: 'orbit', name: '环绕', sub: '慢速环绕主楼', type: 'orbit', center: [-4, 10, 0], radius: 88, height: 62, speed: 0.05, start: 0.75, fov: 32 },
  { id: 'site', name: '工地近景', sub: '大门与场内道路', type: 'static', pos: [26, 30, 58], look: [-6, 4, 8], fov: 34 },
  { id: 'crane', name: '塔吊驾驶室', sub: '司机视角', type: 'crane', entity: 'tc', offset: [-0.4, 2.1, -0.2], fov: 58, when: 'Day 3-14', hint: '坐进塔吊驾驶室，看吊钩下的作业面' },
  { id: 'pour', name: '浇筑点', sub: '搅拌车 · 泵车 · 料斗', type: 'static', pos: [-6, 18, 44], look: [-20, 2, 14], fov: 36 },
  { id: 'yard', name: '材料堆场', sub: '叉车卸货 · 钢筋加工', type: 'static', pos: [44, 20, 18], look: [18, 1, -2], fov: 36 },
  { id: 'deck', name: '作业面', sub: '工人随楼层上升', type: 'follow', entity: 'deck-2', dist: 16, height: 10, angle: 2.2, relative: false, orbit: 0.04, fov: 40, when: 'Day 3-12' },
  { id: 'mixer', name: '跟随搅拌车', sub: '进场 · 倒车 · 卸料', type: 'follow', entity: 'mixer-1', dist: 20, height: 9, angle: 2.6, fov: 40, when: 'Day 2.4-12' },
  { id: 'foreman', name: '项目经理', sub: '跟随巡场', type: 'follow', entity: 'foreman', dist: 11, height: 6, angle: 2.6, fov: 42 },
  { id: 'hoist', name: '施工电梯', sub: '随轿厢上行', type: 'ride', entity: 'hoist', part: 'cage', offset: [0, 2, 6], lookAt: [0, 1, -6], fov: 55, when: 'Day 4.3-13.6' },
  { id: 'top', name: '俯视图纸', sub: '对照总平面', type: 'top', center: [-4, 0, 0], height: 170, tilt: 4, fov: 30 },
  // walks the kerb side of the south sidewalk (layout STREET_EYE_Z = 36): props, trees, lamps
  // and the pedestrian line are all south of it (behind the lens), the bus stops on the far
  // kerb. Ends ~48 m from the tower with the ceremony arch + roof sign in frame (lookY/fov).
  // clear: people / vehicles within this many metres of the lens are hidden (safety net)
  { id: 'street', name: '街景漫游', sub: '行人视角', type: 'street', path: [[-10, 0, 36], [0, 0, 36], [10, 0, 36], [20, 0, 36], [28, 0, 36]], look: [-4, 0, 0], dur: 40, eye: 2.0, lookY: 11, fov: 60, clear: 2.2 },
  { id: 'desk', name: '桌面', sub: '图纸 · 咖啡 · 模型', type: 'static', pos: [150, 60, 160], look: [30, -6, 30], fov: 28 },
  { id: 'walk', name: '自由漫游', sub: 'WASD 行走', type: 'walk', pos: [-1.5, 0, 34], yaw: PI, eye: 2.1, auto: false }
]

const s = (shot, t, extra = {}) => ({ shot, t, ...extra })

export const storyboards = [
  {
    id: 'promo60', name: '宣传片 60s', letterbox: true,
    segments: [
      s('desk', 5, { day: 1.02, speed: 1, weather: 'clear', lockHour: 9, caption: '筑城之间', sub: 'LIVING CONSTRUCTION · 桌上的城市' }),
      s('site', 5, { caption: 'Day 1', sub: '挖掘机进场 · 地基开挖' , day: 1.3 }),
      s('mixer', 6, { day: 2.6, caption: 'Day 3', sub: '塔吊安装 · 混凝土车进场' }),
      s('pour', 5, { day: 3.7, sub: '泵车浇筑楼板', caption: '浇筑' }),
      s('deck', 6, { day: 5.25, caption: 'Day 5', sub: '第三层施工 · 脚手架出现' }),
      s('crane', 6, { day: 6.3, caption: '塔吊视角', sub: '钢筋笼 · 模板 · 料斗' }),
      s('yard', 5, { day: 8.2, caption: 'Day 8', sub: '外墙与窗户安装', lockHour: 11 }),
      s('orbit', 6, { day: 10.4, lockHour: 21, caption: '夜间施工', sub: '大黄灯下的作业面' }),
      s('overview', 5, { day: 12.15, lockHour: 16, caption: 'Day 12', sub: '主体封顶 · 塔吊拆除' }),
      s('street', 6, { day: 16.25, lockHour: 17.5, caption: 'Day 16', sub: '围挡拆除 · 绿化 · 路灯 · 竣工', t0: 6 }),
      s('orbit', 5, { lockHour: 19.6, caption: 'ZC TOWER', sub: '筑城之间 · Living Construction' })
    ]
  },
  {
    id: 'timelapse', name: '16 天延时', letterbox: true,
    segments: [
      s('orbit', 6, { day: 1.0, speed: 8, lockHour: 14, caption: 'Day 1', sub: '挖掘 · 地基' }),
      s(null, 6, { caption: 'Day 3', sub: '塔吊 · 第一层' }),
      s(null, 6, { caption: 'Day 5', sub: '第三层 · 脚手架' }),
      s(null, 8, { caption: 'Day 8', sub: '第六层 · 窗户 · 外墙' }),
      s(null, 8, { caption: 'Day 12', sub: '封顶 · 塔吊拆除' }),
      s(null, 8, { caption: 'Day 16', sub: '围挡拆除 · 绿化 · 路灯' }),
      s('overview', 6, { day: 16.3, speed: 1, lockHour: 18.6, caption: '竣工', sub: 'ZC TOWER' })
    ]
  },
  {
    id: 'details', name: '细节巡游 45s',
    segments: [
      s('yard', 7, { day: 9.25, speed: 1, lockHour: 10, caption: '材料进场', sub: '平板车 · 叉车 · 堆场' }),
      s('pour', 7, { caption: '料斗浇筑', sub: '搅拌车倒车 · 塔吊吊斗' }),
      s('crane', 7, { caption: '塔吊司机', sub: '回转 · 变幅 · 起落钩' }),
      s('deck', 8, { caption: '作业面', sub: '支模 · 绑筋 · 振捣' }),
      s('hoist', 6, { caption: '施工电梯', sub: '工人上下班' }),
      s('foreman', 5, { caption: '巡场', sub: '项目经理' }),
      s('street', 5, { caption: '街坊', sub: '围挡外的城市', t0: 10 })
    ]
  }
]

/** auto director: event -> shot id */
export const autoDirector = {
  'crane.lift': 'crane',
  'build.floor': 'orbit',
  milestone: (m) => m.shot || 'overview',
  'mixer.arrive': 'mixer'
}
