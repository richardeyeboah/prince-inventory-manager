import type { Sale } from '../types'
import { roundMoney } from './finance'
import { shopDayKey } from './sales-calendar'

export type ProfitRange = 'today' | '7d' | 'month' | 'pickMonth' | 'year' | 'custom'

export type DayProfit = {
  day: string
  receipts: number
  sales: number
  cost: number
  profit: number
  // Portion of the day's sales (and of its profit) the customer still owes on credit.
  unpaid: number
  unpaidProfit: number
  // Receipts that include a product with no cost price, so their profit is overstated.
  missingCost: number
}

export type ProfitSummary = {
  startDay: string
  endDay: string
  receipts: number
  sales: number
  cost: number
  profit: number
  margin: number
  unpaid: number
  unpaidProfit: number
  realisedProfit: number
  missingCost: number
  days: DayProfit[]
}

const DAY_MS = 24 * 60 * 60 * 1000

export function isDayKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && shopDayKey(`${value}T12:00:00Z`) === value
}

export function shiftDay(day: string, delta: number) {
  return shopDayKey(new Date(Date.parse(`${day}T12:00:00Z`) + delta * DAY_MS))
}

function emptyDay(day: string): DayProfit {
  return { day, receipts: 0, sales: 0, cost: 0, profit: 0, unpaid: 0, unpaidProfit: 0, missingCost: 0 }
}

// Profit still sitting in an unpaid balance: the sale's profit pro-rated by what is owed.
export function unpaidProfitOf(sale: Pick<Sale, 'total' | 'balanceDue' | 'grossProfit'>) {
  if (sale.total <= 0 || sale.balanceDue <= 0) return 0
  return roundMoney(sale.grossProfit * Math.min(1, sale.balanceDue / sale.total))
}

// A sold part with revenue but zero cost almost always means the product has no cost price yet.
// Labor lines legitimately have no cost, so callers pass the labor product ids to skip them.
export function saleMissingCost(sale: Pick<Sale, 'items'>, laborIds: ReadonlySet<string> = new Set()) {
  return sale.items.some((line) => line.lineCost === 0 && line.lineTotal > 0 && !laborIds.has(line.productId))
}

function lastDayOfMonth(month: string) {
  const [year, m] = month.split('-').map(Number)
  return `${month}-${String(new Date(Date.UTC(year, m, 0)).getUTCDate()).padStart(2, '0')}`
}

// Inclusive shop-day bounds for a reporting range. Returns null when custom input is incomplete or invalid.
export function profitRangeBounds(
  range: ProfitRange,
  options: { month?: string; start?: string; end?: string } = {},
  now: Date | string = new Date(),
): { startDay: string; endDay: string } | null {
  const today = shopDayKey(now)
  if (range === 'today') return { startDay: today, endDay: today }
  if (range === '7d') return { startDay: shiftDay(today, -6), endDay: today }
  if (range === 'month') return { startDay: `${today.slice(0, 7)}-01`, endDay: today }
  if (range === 'year') return { startDay: `${today.slice(0, 4)}-01-01`, endDay: today }
  if (range === 'pickMonth') {
    const month = options.month ?? ''
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null
    const endDay = lastDayOfMonth(month)
    // The current month stops at today so charts don't show empty future days.
    return { startDay: `${month}-01`, endDay: endDay > today ? today : endDay }
  }
  const start = options.start ?? ''
  const end = options.end ?? ''
  if (!isDayKey(start) || !isDayKey(end) || start > end) return null
  return { startDay: start, endDay: end }
}

// Groups completed sales by Ghana shop day. Voided sales never count; adjusted sales already carry net figures.
export function profitByDay(sales: Sale[], laborIds: ReadonlySet<string> = new Set()): Map<string, DayProfit> {
  const result = new Map<string, DayProfit>()
  for (const sale of sales) {
    if (sale.voidedAt) continue
    const day = shopDayKey(sale.createdAt)
    if (!day) continue
    const entry = result.get(day) ?? emptyDay(day)
    entry.receipts += 1
    entry.sales = roundMoney(entry.sales + sale.total)
    entry.cost = roundMoney(entry.cost + sale.costTotal)
    entry.profit = roundMoney(entry.profit + sale.grossProfit)
    entry.unpaid = roundMoney(entry.unpaid + Math.max(0, sale.balanceDue))
    entry.unpaidProfit = roundMoney(entry.unpaidProfit + unpaidProfitOf(sale))
    if (saleMissingCost(sale, laborIds)) entry.missingCost += 1
    result.set(day, entry)
  }
  return result
}

export function summarizeProfit(sales: Sale[], startDay: string, endDay: string, laborIds: ReadonlySet<string> = new Set()): ProfitSummary {
  const days = [...profitByDay(sales, laborIds).values()]
    .filter((entry) => entry.day >= startDay && entry.day <= endDay)
    .sort((a, b) => b.day.localeCompare(a.day))
  const totals = days.reduce(
    (sum, entry) => ({
      receipts: sum.receipts + entry.receipts,
      sales: roundMoney(sum.sales + entry.sales),
      cost: roundMoney(sum.cost + entry.cost),
      profit: roundMoney(sum.profit + entry.profit),
      unpaid: roundMoney(sum.unpaid + entry.unpaid),
      unpaidProfit: roundMoney(sum.unpaidProfit + entry.unpaidProfit),
      missingCost: sum.missingCost + entry.missingCost,
    }),
    { receipts: 0, sales: 0, cost: 0, profit: 0, unpaid: 0, unpaidProfit: 0, missingCost: 0 },
  )
  return {
    startDay,
    endDay,
    ...totals,
    margin: totals.sales > 0 ? totals.profit / totals.sales : 0,
    realisedProfit: roundMoney(totals.profit - totals.unpaidProfit),
    days,
  }
}

// Every shop day in the range (oldest first), including days with no sales, for charts.
export function profitSeries(summary: ProfitSummary, maxDays = 31): DayProfit[] {
  const byDay = new Map(summary.days.map((entry) => [entry.day, entry]))
  const series: DayProfit[] = []
  for (let day = summary.endDay; day >= summary.startDay && series.length < maxDays; day = shiftDay(day, -1)) {
    series.push(byDay.get(day) ?? emptyDay(day))
  }
  return series.reverse()
}

// Number of calendar days a summary covers, inclusive.
export function spanDays(summary: Pick<ProfitSummary, 'startDay' | 'endDay'>) {
  return Math.round((Date.parse(`${summary.endDay}T12:00:00Z`) - Date.parse(`${summary.startDay}T12:00:00Z`)) / DAY_MS) + 1
}

// Owner preference: ignore sales before this shop day when reading profit. Stored on the device only;
// nothing in the database changes, and clearing it brings every sale straight back.
const START_KEY = 'prince-profit-start-day'

export function loadProfitStartDay(): string | null {
  try {
    const value = localStorage.getItem(START_KEY) ?? ''
    return isDayKey(value) ? value : null
  } catch { return null }
}

export function saveProfitStartDay(day: string | null) {
  try {
    if (day && isDayKey(day)) localStorage.setItem(START_KEY, day)
    else localStorage.removeItem(START_KEY)
  } catch { /* Storage may be restricted. */ }
}

// Clips a range so it never begins before the chosen start day. Returns null when nothing is left.
export function applyStartDay<T extends { startDay: string; endDay: string }>(bounds: T | null, startDay: string | null): T | null {
  if (!bounds || !startDay || startDay <= bounds.startDay) return bounds
  if (startDay > bounds.endDay) return null
  return { ...bounds, startDay }
}

export function shortDayLabel(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', day: 'numeric', month: 'short' })
}

export function rangeLabel(summary: ProfitSummary, today = shopDayKey()) {
  if (summary.startDay === summary.endDay) return summary.startDay === today ? 'Today' : shortDayLabel(summary.startDay)
  return `${shortDayLabel(summary.startDay)} – ${shortDayLabel(summary.endDay)}`
}
