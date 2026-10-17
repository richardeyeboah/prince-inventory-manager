import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { money } from '../lib/format'
import { shiftDay } from '../lib/profit'
import { shopDayKey } from '../lib/sales-calendar'
import { useShop } from '../store'

type Range = 'today' | '7d' | '30d' | 'month' | 'year' | 'all'

const ranges: { id: Range; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
]

const methodLabel = { cash: 'Cash', mobile_money: 'Mobile Money', card: 'Card', transfer: 'Transfer', credit: 'Credit' } as const

export function ReportsView() {
  const { sales, payments, isOwner } = useShop()
  const [range, setRange] = useState<Range>('7d')

  const report = useMemo(() => {
    const active = sales.filter((s) => !s.voidedAt)
    // Ranges follow Ghana shop days so Reports agree with the Sales calendar and dashboard.
    const today = shopDayKey()
    const isInRange = (iso: string) => {
      if (range === 'all') return true
      const day = shopDayKey(iso)
      if (range === 'today') return day === today
      if (range === 'month') return day.slice(0, 7) === today.slice(0, 7)
      if (range === 'year') return day.slice(0, 4) === today.slice(0, 4)
      const days = range === '7d' ? 7 : 30
      return day >= shiftDay(today, -(days - 1)) && day <= today
    }

    const inRange = active.filter((sale) => isInRange(sale.createdAt))
    const activePayments = payments.filter(
      (payment) => !payment.reversedAt && isInRange(payment.createdAt),
    )

    const revenue = inRange.reduce((sum, s) => sum + s.total, 0)
    const subtotal = inRange.reduce((sum, s) => sum + s.subtotal, 0)
    const tax = inRange.reduce((sum, s) => sum + s.taxTotal, 0)
    const cost = inRange.reduce((sum, s) => sum + s.costTotal, 0)
    const profit = inRange.reduce((sum, s) => sum + s.grossProfit, 0)
    const salesWithLedger = new Set(payments.map((payment) => payment.saleId))
    const collected =
      activePayments.reduce((sum, payment) => sum + payment.amount, 0) +
      inRange
        .filter((sale) => !salesWithLedger.has(sale.id))
        .reduce((sum, sale) => sum + sale.amountPaid, 0)
    const outstanding = inRange.reduce((sum, s) => sum + s.balanceDue, 0)
    const items = inRange.reduce((sum, s) => sum + s.items.reduce((n, i) => n + i.qty, 0), 0)
    const avgTicket = inRange.length > 0 ? revenue / inRange.length : 0

    const byMethod = new Map<string, { sales: number; revenue: number; profit: number }>()
    for (const s of inRange) {
      const cur = byMethod.get(s.paymentMethod) ?? { sales: 0, revenue: 0, profit: 0 }
      cur.sales += 1
      cur.revenue += s.total
      cur.profit += s.grossProfit
      byMethod.set(s.paymentMethod, cur)
    }

    const byWorker = new Map<string, { sales: number; revenue: number; profit: number }>()
    for (const s of inRange) {
      const name = s.workerName || 'Unknown'
      const cur = byWorker.get(name) ?? { sales: 0, revenue: 0, profit: 0 }
      cur.sales += 1
      cur.revenue += s.total
      cur.profit += s.grossProfit
      byWorker.set(name, cur)
    }

    const byItem = new Map<string, { qty: number; revenue: number; profit: number }>()
    const byDay = new Map<string, { count: number; sales: number; tax: number; profit: number }>()
    for (const s of inRange) {
      const day = shopDayKey(s.createdAt)
      const daily = byDay.get(day) ?? { count: 0, sales: 0, tax: 0, profit: 0 }
      daily.count += 1
      daily.sales += s.total
      daily.tax += s.taxTotal
      daily.profit += s.grossProfit
      byDay.set(day, daily)
      for (const item of s.items) {
        const cur = byItem.get(item.name) ?? { qty: 0, revenue: 0, profit: 0 }
        cur.qty += item.qty
        cur.revenue += item.qty * item.price
        cur.profit += item.grossProfit
        byItem.set(item.name, cur)
      }
    }

    return {
      inRange,
      revenue,
      subtotal,
      tax,
      cost,
      profit,
      collected,
      outstanding,
      items,
      avgTicket,
      byMethod: [...byMethod.entries()].sort((a, b) => b[1].revenue - a[1].revenue),
      byWorker: [...byWorker.entries()].sort((a, b) => b[1].revenue - a[1].revenue),
      byItem: [...byItem.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 12),
      byDay: [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])),
    }
  }, [sales, payments, range])

  function exportCsv() {
    const rows: string[][] = [
      ['Receipt', 'Date', 'Worker', 'Customer', 'Payment', 'Status', 'Item', 'Qty', 'Unit price (GHS)', 'Subtotal (GHS)', 'Tax (GHS)', 'Total (GHS)', 'Cost (GHS)', 'Gross profit (GHS)', 'Paid (GHS)', 'Balance (GHS)'],
    ]
    for (const s of report.inRange) {
      for (const item of s.items) {
        rows.push([
          s.receiptNumber,
          s.createdAt,
          s.workerName,
          s.customerName,
          s.paymentMethod,
          s.paymentStatus,
          item.name,
          String(item.qty),
          item.price.toFixed(2),
          item.lineSubtotal.toFixed(2),
          item.taxAmount.toFixed(2),
          item.lineTotal.toFixed(2),
          item.lineCost.toFixed(2),
          item.grossProfit.toFixed(2),
          s.amountPaid.toFixed(2),
          s.balanceDue.toFixed(2),
        ])
      }
    }
    const csv = rows
      .map((r) => r.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prince-auto-sales-${range}-${shopDayKey()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="view reports-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Numbers</p>
          <h1>Reports</h1>
          <p className="page-description">Sales reflect returns and corrections on the original sale date. Collected includes refunds on the day recorded.</p>
        </div>
        {isOwner && report.inRange.length > 0 && (
          <button type="button" className="primary-btn" onClick={exportCsv}>
            <Download size={17} aria-hidden />
            Export CSV
          </button>
        )}
      </header>

      <div className="range-tabs" role="tablist" aria-label="Report range">
        {ranges.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={range === r.id}
            className={range === r.id ? 'active' : ''}
            onClick={() => setRange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Total sales</span>
            <strong className="kpi-value">{money(report.revenue)}</strong>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Sales before tax</span>
            <strong className="kpi-value">{money(report.subtotal)}</strong>
          </div>
        </div>
        {isOwner && (
          <>
            <div className="kpi-card">
              <div className="kpi-body">
                <span className="kpi-label">Gross profit{report.revenue > 0 ? ` · ${Math.round(report.profit / report.revenue * 100)}% of sales` : ''}</span>
                <strong className="kpi-value">{money(report.profit)}</strong>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-body">
                <span className="kpi-label">Cost of parts sold</span>
                <strong className="kpi-value">{money(report.cost)}</strong>
              </div>
            </div>
          </>
        )}
        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Tax collected</span>
            <strong className="kpi-value">{money(report.tax)}</strong>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Collected</span>
            <strong className="kpi-value">{money(report.collected)}</strong>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Balance due</span>
            <strong className="kpi-value">{money(report.outstanding)}</strong>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Sales</span>
            <strong className="kpi-value">{report.inRange.length}</strong>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Items sold</span>
            <strong className="kpi-value">{report.items}</strong>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Average sale</span>
            <strong className="kpi-value">{money(report.avgTicket)}</strong>
          </div>
        </div>
      </div>

      {report.inRange.length === 0 ? (
        <p className="empty-note card">No sales in this range yet.</p>
      ) : (
        <div className="report-grid">
          <section className="card" aria-label="Revenue by payment method">
            <div className="card-head">
              <h2>By payment</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th className="num">Sales</th>
                  <th className="num">Revenue</th>
                  {isOwner && <th className="num">Profit</th>}
                </tr>
              </thead>
              <tbody>
                {report.byMethod.map(([method, row]) => (
                  <tr key={method}>
                    <td>{methodLabel[method as keyof typeof methodLabel] ?? method}</td>
                    <td className="num">{row.sales}</td>
                    <td className="num">{money(row.revenue)}</td>
                    {isOwner && <td className="num">{money(row.profit)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card" aria-label="Revenue by worker">
            <div className="card-head">
              <h2>By worker</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th className="num">Sales</th>
                  <th className="num">Revenue</th>
                  {isOwner && <th className="num">Profit</th>}
                </tr>
              </thead>
              <tbody>
                {report.byWorker.map(([name, row]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td className="num">{row.sales}</td>
                    <td className="num">{money(row.revenue)}</td>
                    {isOwner && <td className="num">{money(row.profit)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card report-items" aria-label="Top items">
            <div className="card-head">
              <h2>Top items</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Revenue</th>
                  {isOwner && <th className="num">Profit</th>}
                </tr>
              </thead>
              <tbody>
                {report.byItem.map(([name, row]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td className="num">{row.qty}</td>
                    <td className="num">{money(row.revenue)}</td>
                    {isOwner && <td className="num">{money(row.profit)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card report-items" aria-label="Daily financial summary">
            <div className="card-head">
              <h2>Daily summary</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Receipts</th>
                  <th className="num">Sales</th>
                  <th className="num">Tax</th>
                  {isOwner && <th className="num">Profit</th>}
                </tr>
              </thead>
              <tbody>
                {report.byDay.map(([day, row]) => (
                  <tr key={day}>
                    <td>{day}</td>
                    <td className="num">{row.count}</td>
                    <td className="num">{money(row.sales)}</td>
                    <td className="num">{money(row.tax)}</td>
                    {isOwner && <td className="num">{money(row.profit)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  )
}
