/** Data contract of the example screen (`/mock/example.json` or `VITE_API_URL`). */

export type KpiId = 'users' | 'pointsRedeemed' | 'redemptions' | 'itemsRedeemed'

export interface ExampleKpi {
  id: KpiId
  value: number
  /** Change vs. previous month, percent */
  delta: number
}

export interface ExampleTrend {
  /** `YYYY-MM`, formatted per locale on screen */
  months: string[]
  /** Points earned per month */
  points: number[]
  /** Staff who scored per month */
  people: number[]
}

export interface ExampleCategory {
  name: string
  value: number
}

export interface ExampleCycle {
  people: number
  earned: number
  redeemed: number
  redemptions: number
}

export interface ExampleConversion {
  /** Average points per scorer */
  avgPoints: number
  /** Staff who redeemed this month */
  redeemers: number
  /** Redeemed / earned points, percent */
  usageRate: number
  /** Redeemers / scorers, percent */
  participationRate: number
}

export interface ExampleTeam {
  team: string
  points: number
}

export interface ExamplePerson {
  id: number
  name: string
  team: string
  points: number
}

export interface ExampleGoods {
  name: string
  times: number
}

export interface ExampleScreenData {
  project: string
  kpis: ExampleKpi[]
  trend: ExampleTrend
  categories: ExampleCategory[]
  cycle: ExampleCycle
  conversion: ExampleConversion
  teams: ExampleTeam[]
  people: ExamplePerson[]
  goods: ExampleGoods[]
}
