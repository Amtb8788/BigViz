/**
 * Minimal en / zh dictionary for the example screen. UI chrome is translated here; data values
 * (team names, goods, categories) come from the API as-is.
 */
import { computed, ref, watchEffect } from 'vue'

export type Locale = 'en' | 'zh'

const en = {
  title: 'Safety Points Data Center',
  loading: 'Loading data…',
  loadError: 'Failed to load data',
  retry: 'Retry',
  empty: 'No data',
  switchTo: '中文',
  switchLabel: 'Switch language to Chinese',
  logoAlt: 'BigViz logo',
  hubAlt: 'Glowing shield on a holographic pedestal',
  podiumAlt: 'Three-step podium with a trophy on the first place',
  panel: {
    trend: 'Points Trend',
    people: 'Top Staff This Month',
    teams: 'Top Teams This Month',
    conversion: 'Points Usage',
    goods: 'Top Redeemed Goods',
    categories: 'Redemption Mix'
  },
  legend: { points: 'Points earned', people: 'Scorers' },
  kpi: {
    users: 'Total Users',
    pointsRedeemed: 'Points Redeemed',
    redemptions: 'Redemptions',
    itemsRedeemed: 'Items Redeemed',
    vsLastMonth: 'vs last month'
  },
  hub: {
    people: { title: 'Scorers', label: 'Staff who scored' },
    earned: { title: 'Points Earned', label: 'Earned this month' },
    redeemed: { title: 'Points Redeemed', label: 'Redeemed this month' },
    redemptions: { title: 'Redemptions', label: 'Orders this month' }
  },
  conv: {
    avg: 'Avg points per scorer',
    redeemers: 'Redeemers this month',
    usage: 'Usage rate',
    usageFormula: 'redeemed / earned',
    participation: 'Participation',
    participationFormula: 'redeemers / scorers'
  },
  chart: {
    trend: 'Monthly points earned and number of scorers',
    categories: 'Share of redeemed items by category',
    total: 'Items redeemed',
    monthTotal: 'This month'
  },
  unit: { people: 'ppl', points: 'pts', times: 'x', items: 'pcs' }
}

type Dict = typeof en

const zh: Dict = {
  title: '安全积分数据中心',
  loading: '数据加载中…',
  loadError: '数据加载失败',
  retry: '重新加载',
  empty: '暂无数据',
  switchTo: 'EN',
  switchLabel: '切换为英文',
  logoAlt: 'BigViz 标志',
  hubAlt: '全息底座上的发光盾牌',
  podiumAlt: '三级领奖台，第一名台上有奖杯',
  panel: {
    trend: '积分获得趋势',
    people: '本月人员积分排行',
    teams: '本月班组积分排行',
    conversion: '积分使用分析',
    goods: '商品兑换排行',
    categories: '商品兑换结构'
  },
  legend: { points: '获得积分', people: '得分人数' },
  kpi: {
    users: '总用户数',
    pointsRedeemed: '累计兑换积分',
    redemptions: '累计兑换次数',
    itemsRedeemed: '累计兑换件数',
    vsLastMonth: '较上月'
  },
  hub: {
    people: { title: '得分人数', label: '本月得分人数' },
    earned: { title: '获得积分', label: '本月获得积分' },
    redeemed: { title: '兑换积分', label: '本月兑换积分' },
    redemptions: { title: '兑换次数', label: '本月兑换次数' }
  },
  conv: {
    avg: '人均获得积分',
    redeemers: '本月兑换人数',
    usage: '积分使用率',
    usageFormula: '已兑换 / 已获得积分',
    participation: '兑换参与率',
    participationFormula: '兑换人数 / 得分人数'
  },
  chart: {
    trend: '每月获得积分与得分人数',
    categories: '各类商品兑换件数占比',
    total: '兑换总件数',
    monthTotal: '本月总积分'
  },
  unit: { people: '人', points: '分', times: '次', items: '件' }
}

const DICTS: Record<Locale, Dict> = { en, zh }
const STORAGE_KEY = 'bigviz-example-locale'

const initial = (): Locale => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'zh') return saved
  } catch {
    // storage may be blocked; fall through
  }
  return 'en'
}

const locale = ref<Locale>(initial())

watchEffect(() => {
  document.documentElement.lang = locale.value === 'zh' ? 'zh-CN' : 'en'
  try {
    localStorage.setItem(STORAGE_KEY, locale.value)
  } catch {
    // ignore
  }
})

/** Shared locale state and dictionary for the example screen */
export function useI18n() {
  const t = computed(() => DICTS[locale.value])
  /** BCP 47 tag for Intl formatting */
  const tag = computed(() => (locale.value === 'zh' ? 'zh-CN' : 'en-US'))
  const toggle = () => (locale.value = locale.value === 'en' ? 'zh' : 'en')
  return { locale, t, tag, toggle }
}
