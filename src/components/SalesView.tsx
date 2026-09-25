import { useMemo, useState } from 'react'
import { Printer, RotateCcw } from 'lucide-react'
import { formatDateTime, money } from '../lib/format'
import { useShop } from '../store'
import type { Sale } from '../types'
import { SalesCalendar } from './SalesCalendar'
import { TestJob } from './TestJob'
import { dayLabel, shopDayKey } from '../lib/sales-calendar'
import { SalesResetPanel } from './SalesResetPanel'
import { VoidForm } from './VoidForm'
import { ReturnForm } from './ReturnForm'
import { ReceiptModal } from './ReceiptModal'

const methodLabel = {
  cash: 'Cash', mobile_money: 'Mobile Money',
  card: 'Card',
  transfer: 'Transfer',
  credit: 'Credit',
} as const

export function SalesView() {
  const { allSales, isOwner } = useShop()
  const [scope, setScope] = useState('all')
  const [selected, setSelected] = useState(() => shopDayKey())
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const [testJob, setTestJob] = useState(false)
  const sales = useMemo(() => allSales.filter((sale) => scope === 'all' || (scope === 'history' ? Boolean(sale.resetId) : !sale.resetId)), [allSales, scope])
  const counts = useMemo(() => {
    const result = new Map<string, number>()
    for (const sale of sales) { const day = shopDayKey(sale.createdAt); result.set(day, (result.get(day) ?? 0) + 1) }
    return result
  }, [sales])
  const daily = sales.filter((sale) => shopDayKey(sale.createdAt) === selected)
  const completed = daily.filter((sale) => !sale.voidedAt)
  const voided = daily.filter((sale) => sale.voidedAt)
  return <div className="view sales-view">
    <header className="view-header">
      <div><p className="eyebrow">Receipt history</p><h1>Sales</h1></div>
      {isOwner && <button type="button" className="primary-btn" onClick={() => setTestJob(true)}>Test job</button>}
    </header>
    <label className="sales-history-filter">Receipts to show<select value={scope} onChange={(e) => setScope(e.target.value)}>
      <option value="all">All receipts, including reset history</option><option value="active">Active sales only</option><option value="history">Reset history only</option>
    </select></label>
    <SalesCalendar selected={selected} counts={counts} onSelect={setSelected} />
    <section className="sales-section" aria-label="Selected day's sales">
      <h2>{dayLabel(selected)}</h2>
      <div className="daily-sales-summary" aria-live="polite">
        <span><strong>{daily.length}</strong> receipts</span>
        <span><strong>{money(completed.reduce((sum, sale) => sum + sale.total, 0))}</strong> sales after returns</span>
        <span><strong>{voided.length}</strong> voided</span>
      </div>
      {scope !== 'active' && daily.some((sale) => sale.resetId) && <p className="calendar-hint">Includes archived sales from a totals reset. Opening them does not restore them to active totals.</p>}
      {daily.length === 0 && <p className="empty-note panel">No receipts for this date in the selected history. Choose another date or change the filter.</p>}
      {completed.length > 0 && <SaleList key={selected + scope} sales={completed} onReceipt={setReceipt} />}
      {voided.length > 0 && <><h3>Voided receipts</h3><SaleList key={'void-' + selected + scope} sales={voided} voided onReceipt={setReceipt} /></>}
    </section>
    {isOwner && <SalesResetPanel />}
    {receipt && <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} />}
    {testJob && isOwner && <TestJob onClose={() => setTestJob(false)} />}
  </div>
}

function SaleList({
  sales,
  voided = false,
  onReceipt,
}: {
  sales: Sale[]
  voided?: boolean
  onReceipt: (sale: Sale) => void
}) {
  const { isOwner, adjustments } = useShop()
  const [editing, setEditing] = useState<string | null>(null)
  const [voiding, setVoiding] = useState<string | null>(null)

  const canVoid = (sale: Sale) => {
    if (sale.voidedAt || sale.adjustmentVersion) return false
    return isOwner
  }

  return (
    <ul className="sales-list">
      {sales.map((sale) => (
        <li key={sale.id} className={`sale-row ${sale.voidedAt || voided ? 'is-void' : ''}`}>
          <div className="sale-top">
            <div>
              <strong>{money(sale.total)}</strong>
              {sale.voidedAt && <span className="void-badge">Voided</span>}
              {!sale.voidedAt && sale.paymentStatus !== 'paid' && (
                <span className={`status-badge ${sale.paymentStatus}`}>
                  {sale.paymentStatus === 'partial' ? 'Partially paid' : 'Payment due'}
                </span>
              )}
            </div>
            <span className="sale-meta">
              {methodLabel[sale.paymentMethod]} · {formatDateTime(sale.createdAt)}
            </span>
          </div>

          {sale.customerName && (
            <p className="sale-customer">
              {sale.customerName}
            </p>
          )}

          <p className="sale-worker">Receipt {sale.receiptNumber} · Sold by {sale.workerName}{sale.resetId ? ' · Reset history' : ''}</p>

          <ul className="sale-items">
            {sale.items.map((item) => (
              <li key={`${sale.id}-${item.productId}`}>
                {item.qty}× {item.name}
                <span>
                  {money(item.lineTotal)}
                  {isOwner && (
                    <small className="line-profit">Profit {money(item.grossProfit)}</small>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <div className="sale-summary">
            <span>Subtotal {money(sale.subtotal)}</span>
            <span>Tax {money(sale.taxTotal)}</span>
            {sale.balanceDue > 0 && <strong>Balance {money(sale.balanceDue)}</strong>}
            {isOwner && <strong>Profit {money(sale.grossProfit)}</strong>}
          </div>

          {adjustments.filter((a) => a.sale_id === sale.id).map((a) => <p key={a.id} className="sale-worker">
            {formatDateTime(a.created_at)} · {a.reason} · Sale {money(Number(a.before_sale.total))} → {money(Number(a.after_sale.total))} · Refunded {money(Number(a.refund_amount))} ({methodLabel[a.payment_method]}) · Restocked {a.restocked} · Recorded by {a.recorded_by}
          </p>)}
          {editing === sale.id && <ReturnForm key={`${sale.id}:${sale.adjustmentVersion}`} sale={sale} onClose={() => setEditing(null)} />}
          {voiding === sale.id && <VoidForm sale={sale} onClose={() => setVoiding(null)} />}
          <div className="sale-actions">
            {!sale.voidedAt && <button type="button" className="ghost-btn" onClick={() => setEditing(sale.id)}>Return / edit items</button>}
            <button type="button" className="ghost-btn" onClick={() => onReceipt(sale)}>
              <Printer size={16} aria-hidden />
              {sale.voidedAt ? 'Void receipt / original' : 'Receipt'}
            </button>
            {canVoid(sale) && (
              <button
                type="button"
                className="ghost-btn danger void-btn"
                onClick={() => setVoiding(sale.id)}
              >
                <RotateCcw size={16} aria-hidden />
                Void sale
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
