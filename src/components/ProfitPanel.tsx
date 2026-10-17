import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpRight, CalendarClock, TrendingUp, X } from 'lucide-react'
import { money, formatDateTime } from '../lib/format'
import {
  applyStartDay, profitRangeBounds, profitSeries, rangeLabel, shortDayLabel, spanDays, summarizeProfit, type ProfitRange,
} from '../lib/profit'
import { shopDayKey } from '../lib/sales-calendar'
import { useShop } from '../store'
import { SalesResetPanel } from './SalesResetPanel'

const ranges: { id: ProfitRange; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'pickMonth', label: 'Pick month' },
  { id: 'custom', label: 'Dates' },
]

type Basis = 'all' | 'collected'

function percent(value: number) {
  return `${(value * 100).toFixed(value >= 0.1 ? 0 : 1)}%`
}

function monthLabel(month: string) {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', month: 'short', year: 'numeric' })
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

type Props = {
  onNavigate: (tab: 'sales' | 'stock') => void
  startDay: string | null
  onStartDayChange: (day: string | null) => void
}

export function ProfitPanel({ onNavigate, startDay, onStartDayChange }: Props) {
  const { sales, allSales, resets, products } = useShop()
  const today = shopDayKey()
  const [range, setRange] = useState<ProfitRange>('month')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [start, setStart] = useState(`${today.slice(0, 7)}-01`)
  const [end, setEnd] = useState(today)
  const [basis, setBasis] = useState<Basis>('all')
  const [showAllDays, setShowAllDays] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [editingStart, setEditingStart] = useState(false)
  const [startDraft, setStartDraft] = useState(startDay ?? today)

  const laborIds = useMemo(() => new Set(products.filter((p) => p.isLabor).map((p) => p.id)), [products])
  const bounds = applyStartDay(profitRangeBounds(range, { month, start, end }), startDay)
  const rangeStart = bounds?.startDay ?? ''
  const rangeEnd = bounds?.endDay ?? ''
  const summary = useMemo(
    () => rangeStart && rangeEnd ? summarizeProfit(sales, rangeStart, rangeEnd, laborIds) : null,
    [sales, rangeStart, rangeEnd, laborIds],
  )
  const archived = useMemo(() => {
    const rows = allSales.filter((sale) => sale.resetId && !sale.voidedAt)
    return { count: rows.length, total: rows.reduce((sum, sale) => sum + sale.total, 0) }
  }, [allSales])
  const missingCostProducts = useMemo(() => products.filter((p) => !p.isLabor && p.costPrice <= 0), [products])
  const lastReset = resets.find((reset) => !reset.restored_at)

  const profitOf = (entry: { profit: number; unpaidProfit: number }) => basis === 'all' ? entry.profit : entry.profit - entry.unpaidProfit
  const headline = summary ? (basis === 'all' ? summary.profit : summary.realisedProfit) : 0

  // Up to 31 bars by day; longer ranges roll up by month so a year still fits on one screen.
  const bars = useMemo(() => {
    if (!summary) return []
    const pick = (day: { profit: number; unpaidProfit: number }) => basis === 'all' ? day.profit : day.profit - day.unpaidProfit
    if (spanDays(summary) <= 31) return profitSeries(summary, 31).map((day) => ({ key: day.day, label: shortDayLabel(day.day), profit: pick(day), sales: day.sales, current: day.day === today }))
    const months = new Map<string, { profit: number; sales: number }>()
    for (const day of summary.days) {
      const key = day.day.slice(0, 7)
      const entry = months.get(key) ?? { profit: 0, sales: 0 }
      months.set(key, { profit: entry.profit + pick(day), sales: entry.sales + day.sales })
    }
    return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ key, label: monthLabel(key), ...value, current: key === today.slice(0, 7) }))
  }, [summary, today, basis])
  const maxBar = Math.max(1, ...bars.map((bar) => Math.abs(bar.profit)))
  const visibleDays = summary ? (showAllDays ? summary.days : summary.days.slice(0, 10)) : []

  const commitStartDay = (value: string | null) => {
    onStartDayChange(value)
    setEditingStart(false)
    setShowAllDays(false)
  }

  return <section className="card profit-card" id="profit" aria-labelledby="profit-title">
    <div className="card-head profit-head">
      <div><h2 id="profit-title">Profit</h2><p className="card-caption">Sales (incl. tax) minus the cost price of the parts sold · grouped by Ghana shop day</p></div>
      <div className="range-tabs profit-ranges" role="tablist" aria-label="Profit period">
        {ranges.map((item) => <button key={item.id} type="button" role="tab" aria-selected={range === item.id} className={range === item.id ? 'active' : ''} onClick={() => { setRange(item.id); setShowAllDays(false) }}>{item.label}</button>)}
      </div>
    </div>
    {(range === 'pickMonth' || range === 'custom') && <div className="profit-pickers">
      {range === 'pickMonth' && <label>Month<input type="month" value={month} max={today.slice(0, 7)} onChange={(e) => setMonth(e.target.value)} /></label>}
      {range === 'custom' && <><label>From<input type="date" value={start} max={end || today} onChange={(e) => setStart(e.target.value)} /></label><label>Through<input type="date" value={end} min={start} max={today} onChange={(e) => setEnd(e.target.value)} /></label></>}
    </div>}

    {startDay && <p className="profit-start-banner"><CalendarClock size={16} aria-hidden /><span>Counting profit from <strong>{shortDayLabel(startDay)}</strong> on this device. Earlier sales are hidden from these figures, not deleted.</span><button type="button" className="link-btn" onClick={() => commitStartDay(null)}>Show all dates</button></p>}

    {!summary ? <p className="profit-note" role="status">{startDay && profitRangeBounds(range, { month, start, end }) ? `This period ends before ${shortDayLabel(startDay)}, your chosen start day.` : 'Choose a valid period. The start date must not be after the end date.'}</p> : <>
      <div className="profit-totals">
        <div className="profit-total featured">
          <span>{basis === 'all' ? 'Gross profit' : 'Profit on money received'} · {rangeLabel(summary, today)}</span>
          <strong>{money(headline)}</strong>
          <small>{summary.sales > 0 ? `${percent(headline / summary.sales)} of sales` : 'No sales in this period'}</small>
        </div>
        <div className="profit-total"><span>Sales</span><strong>{money(summary.sales)}</strong><small>{plural(summary.receipts, 'receipt')}</small></div>
        <div className="profit-total"><span>Cost of parts sold</span><strong>{money(summary.cost)}</strong><small>From each product's cost price</small></div>
        <div className="profit-total"><span>Average per trading day</span><strong>{money(summary.days.length ? headline / summary.days.length : 0)}</strong><small>{plural(summary.days.length, 'day')} with sales</small></div>
      </div>

      {summary.unpaid > 0 && <div className="profit-credit" role="group" aria-label="Credit sales in this period">
        <div>
          <strong>{money(summary.unpaid)} of these sales is still owed by customers</strong>
          <span>That balance carries {money(summary.unpaidProfit)} of the profit. Gross profit counts it when the sale is made; "money received" counts only the paid share.</span>
        </div>
        <div className="range-tabs profit-basis" role="tablist" aria-label="Profit basis">
          <button type="button" role="tab" aria-selected={basis === 'all'} className={basis === 'all' ? 'active' : ''} onClick={() => setBasis('all')}>Gross profit</button>
          <button type="button" role="tab" aria-selected={basis === 'collected'} className={basis === 'collected' ? 'active' : ''} onClick={() => setBasis('collected')}>Money received</button>
        </div>
      </div>}

      {bars.length > 1 && <div className="profit-chart" role="img" aria-label={bars.map((bar) => `${bar.label}: ${money(bar.profit)} profit`).join(', ')}>
        {bars.map((bar) => <div key={bar.key} className="profit-chart-col" title={`${bar.label} · Profit ${money(bar.profit)} · Sales ${money(bar.sales)}`}>
          <div className="chart-track"><div className={bar.current ? 'chart-bar chart-current' : bar.profit < 0 ? 'chart-bar chart-negative' : 'chart-bar'} style={{ height: (bar.profit ? Math.max(2, Math.abs(bar.profit) / maxBar * 100) : 0) + '%' }} /></div>
          <span>{bar.label}</span>
        </div>)}
      </div>}

      {summary.days.length ? <div className="profit-table-wrap"><table className="data-table profit-table">
        <thead><tr><th>Day</th><th className="num">Receipts</th><th className="num">Sales</th><th className="num col-cost">Cost</th><th className="num">Profit</th></tr></thead>
        <tbody>{visibleDays.map((day) => <tr key={day.day}>
          <td>{day.day === today ? 'Today' : shortDayLabel(day.day)}{day.unpaid > 0 && <small className="profit-row-note">{money(day.unpaid)} on credit</small>}</td>
          <td className="num">{day.receipts}</td>
          <td className="num">{money(day.sales)}</td>
          <td className="num col-cost">{money(day.cost)}</td>
          <td className={profitOf(day) < 0 ? 'num profit-negative' : 'num'}><strong>{money(profitOf(day))}</strong></td>
        </tr>)}</tbody>
      </table>
      {summary.days.length > 10 && <button type="button" className="link-btn" onClick={() => setShowAllDays((value) => !value)}>{showAllDays ? 'Show fewer days' : `Show all ${summary.days.length} days`}</button>}
      </div> : <div className="retail-empty compact"><TrendingUp size={28} /><h3>No completed sales in this period</h3><p>Profit is calculated from each receipt as sales are recorded.</p></div>}

      {(summary.missingCost > 0 || missingCostProducts.length > 0) && <p className="profit-warning"><AlertTriangle size={16} aria-hidden /><span>
        {missingCostProducts.length > 0 ? `${plural(missingCostProducts.length, 'product')} ${missingCostProducts.length === 1 ? 'has' : 'have'} no cost price (${missingCostProducts.slice(0, 3).map((p) => p.name).join(', ')}${missingCostProducts.length > 3 ? '…' : ''}), so their full selling price shows as profit. ` : ''}
        {summary.missingCost > 0 ? `${plural(summary.missingCost, 'receipt')} in this period ${summary.missingCost === 1 ? 'includes' : 'include'} such a part. ` : ''}
        Add the cost price under Products to correct future receipts.</span>
        <button type="button" className="link-btn" onClick={() => onNavigate('stock')}>Fix in Products <ArrowUpRight size={16} /></button>
      </p>}
    </>}

    <div className="profit-footer">
      <p className="profit-note">
        {archived.count > 0
          ? <>Totals exclude {plural(archived.count, 'sale')} ({money(archived.total)}) archived by a reset{lastReset ? ` on ${formatDateTime(lastReset.created_at)}` : ''}. Archived sales stay in history and can be restored.</>
          : 'Voided receipts are excluded. Returns and price corrections are already reflected in each day\'s figures.'}
      </p>
      <div className="profit-footer-actions">
        <button type="button" className="link-btn" onClick={() => onNavigate('sales')}>Sales calendar <ArrowUpRight size={16} /></button>
        <button type="button" className="ghost-btn" aria-expanded={editingStart} onClick={() => { setStartDraft(startDay ?? today); setEditingStart((v) => !v); setShowReset(false) }}><CalendarClock size={16} /> {startDay ? 'Change start day' : 'Count from a date…'}</button>
        <button type="button" className="ghost-btn" aria-expanded={showReset} onClick={() => { setShowReset((v) => !v); setEditingStart(false) }}>{showReset ? 'Hide reset options' : 'Reset sales totals…'}</button>
      </div>
    </div>

    {editingStart && <form className="profit-start-form" onSubmit={(e) => { e.preventDefault(); commitStartDay(startDraft) }}>
      <div>
        <strong>Read profit from a chosen day</strong>
        <p>Figures on this device will start from the day you pick. Nothing is deleted or moved: switch back to all dates at any time. To archive sales for everyone, use the reset instead.</p>
      </div>
      <label>Start day<input type="date" required value={startDraft} max={today} onChange={(e) => setStartDraft(e.target.value)} /></label>
      <div className="profit-start-actions">
        <button type="submit" className="primary-btn">Use this start day</button>
        {startDay && <button type="button" className="ghost-btn" onClick={() => commitStartDay(null)}>Show all dates</button>}
        <button type="button" className="icon-btn" aria-label="Close" onClick={() => setEditingStart(false)}><X size={18} /></button>
      </div>
    </form>}
    {showReset && <div className="profit-reset"><SalesResetPanel /></div>}
  </section>
}
