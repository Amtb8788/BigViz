/** zh / en strings for the component gallery */
const zh = {
  title: '组件库',
  subtitle: 'BigViz 2D 组件一览 · 演示数据（虚构工地）',
  switchTo: 'English',
  loading: '地图加载中…',
  empty: '暂无数据',
  back: '返回',
  mapRoot: '示例城市',
  panel: {
    gauge: '仪表盘 gauge',
    liquid: '水球 liquid',
    radar: '雷达 radar',
    map: '地图 map · 点击区域下钻',
    funnel: '漏斗 funnel',
    table: '滚动表格 scroll-table',
    alerts: '告警流 alerts'
  },
  gauge: { a: '总体进度', b: '噪声' },
  liquid: { a: '蓄水池水位', b: '油罐液位' },
  flip: { workers: '累计进场人次', days: '安全施工天数', unitPeople: '人次', unitDays: '天' },
  table: { team: '班组', zone: '区域', people: '人数', status: '状态' },
  status: { ok: '在岗', warn: '超时', off: '离场' },
  levels: { info: '提示', warn: '预警', critical: '告警' }
}

const en: typeof zh = {
  title: 'Component Gallery',
  subtitle: 'BigViz 2D kit at a glance · demo data (fictional site)',
  switchTo: '中文',
  loading: 'Loading map…',
  empty: 'No data',
  back: 'Back',
  mapRoot: 'Demo City',
  panel: {
    gauge: 'gauge',
    liquid: 'liquid',
    radar: 'radar',
    map: 'map · click a region to drill in',
    funnel: 'funnel',
    table: 'scroll-table',
    alerts: 'alerts'
  },
  gauge: { a: 'Overall progress', b: 'Noise' },
  liquid: { a: 'Reservoir level', b: 'Fuel tank' },
  flip: { workers: 'Check-ins to date', days: 'Days without incident', unitPeople: '', unitDays: 'days' },
  table: { team: 'Crew', zone: 'Zone', people: 'People', status: 'Status' },
  status: { ok: 'On site', warn: 'Overtime', off: 'Off' },
  levels: { info: 'Info', warn: 'Warn', critical: 'Alarm' }
}

export const DICT = { zh, en }
