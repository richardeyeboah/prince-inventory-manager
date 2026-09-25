import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Banknote, FileText, Printer, Search, WalletCards, X } from 'lucide-react'
import { formatDateTime, money } from '../lib/format'
import { useShop } from '../store'
import type { CollectedPaymentMethod, Sale } from '../types'
import { ModalPortal } from './ModalPortal'
import { StoreContact } from './StoreContact'

export function CreditView() {
  const { allSales: sales, allPayments: payments, recordPayment } = useShop()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Sale | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<CollectedPaymentMethod>('cash')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [statementSale, setStatementSale] = useState<Sale | null>(null)
  const [view, setView] = useState<'outstanding' | 'open' | 'overdue'>('open')
  const resultsRef = useRef<HTMLDivElement>(null)

  const statementSales = useMemo(() => {
    if (!statementSale) return []
    return sales
      .filter((sale) => !sale.voidedAt && (
        statementSale.customerId
          ? sale.customerId === statementSale.customerId
          : sale.customerName === statementSale.customerName && sale.customerPhone === statementSale.customerPhone
      ))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [sales, statementSale])
  const statementSaleIds = useMemo(() => new Set(statementSales.map((sale) => sale.id)), [statementSales])
  const statementPayments = payments
    .filter((payment) => !payment.reversedAt && statementSaleIds.has(payment.saleId))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  const statementBalance = statementSales.reduce((sum, sale) => sum + sale.balanceDue, 0)

  const allBalances = useMemo(() => sales.filter((sale) => !sale.voidedAt && sale.balanceDue > 0), [sales])
  const balances = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return allBalances
      .filter((sale) => view !== 'overdue' || Boolean(sale.dueDate && new Date(`${sale.dueDate}T23:59:59`) < new Date()))
      .filter((sale) => {
        if (!needle) return true
        return [
          sale.customerName,
          sale.customerPhone,
          sale.receiptNumber,
        ].some((value) => value.toLowerCase().includes(needle))
      })
      .sort((a, b) => {
        if (view === 'outstanding') return b.balanceDue - a.balanceDue
        const aOverdue = a.dueDate && new Date(`${a.dueDate}T23:59:59`) < new Date() ? 0 : 1
        const bOverdue = b.dueDate && new Date(`${b.dueDate}T23:59:59`) < new Date() ? 0 : 1
        return aOverdue - bOverdue || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })
  }, [allBalances, query, view])

  const totalOutstanding = allBalances.reduce((sum, sale) => sum + sale.balanceDue, 0)
  const overdue = allBalances.filter(
    (sale) => sale.dueDate && new Date(`${sale.dueDate}T23:59:59`) < new Date(),
  ).length

  function showView(next: 'outstanding' | 'open' | 'overdue') {
    setView(next)
    setQuery('')
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      resultsRef.current?.focus({ preventScroll: true })
    })
  }

  function openPayment(sale: Sale) {
    setSelected(sale)
    setAmount(sale.balanceDue.toFixed(2))
    setMethod('cash')
    setNotes('')
  }

  function closePayment() {
    setSelected(null)
    setAmount('')
    setNotes('')
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault()
    if (!selected || saving) return
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0 || value > selected.balanceDue) return
    setSaving(true)
    const ok = await recordPayment(selected.id, value, method, notes)
    setSaving(false)
    if (ok) closePayment()
  }

  return (
    <div className="view credit-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Accounts receivable</p>
          <h1>Customer balances</h1>
        </div>
      </header>

      <div className="kpi-grid balance-kpis">
        <button type="button" className={`kpi-card ${view === 'outstanding' ? 'is-selected' : ''}`} aria-pressed={view === 'outstanding'} onClick={() => showView('outstanding')}>
          <span className="kpi-icon is-orange"><WalletCards size={20} aria-hidden /></span>
          <div className="kpi-body">
            <span className="kpi-label">Outstanding</span>
            <strong className="kpi-value">{money(totalOutstanding)}</strong>
          </div>
        </button>
        <button type="button" className={`kpi-card ${view === 'open' ? 'is-selected' : ''}`} aria-pressed={view === 'open'} onClick={() => showView('open')}>
          <span className="kpi-icon is-blue"><Banknote size={20} aria-hidden /></span>
          <div className="kpi-body">
            <span className="kpi-label">Open sales</span>
            <strong className="kpi-value">{allBalances.length}</strong>
          </div>
        </button>
        <button type="button" className={`kpi-card ${overdue > 0 ? 'kpi-alert' : ''} ${view === 'overdue' ? 'is-selected' : ''}`} aria-pressed={view === 'overdue'} onClick={() => showView('overdue')}>
          <div className="kpi-body">
            <span className="kpi-label">Overdue</span>
            <strong className="kpi-value">{overdue}</strong>
          </div>
        </button>
      </div>

      <div className="search-row panel-search">
        <Search size={18} aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search customer, phone, or receipt"
          aria-label="Search customer balances"
        />
      </div>

      <div ref={resultsRef} className="balance-results" tabIndex={-1} role="region" aria-label={`${view === 'overdue' ? 'Overdue' : view === 'outstanding' ? 'Outstanding balances' : 'Open sales'} results`}>
      {balances.length === 0 ? (
        <div className="empty-note panel">
          {query ? 'No balances match that search.' : view === 'overdue' ? 'No overdue customer balances.' : 'No outstanding customer balances.'}
        </div>
      ) : (
        <ul className="balance-list">
          {balances.map((sale) => {
            const isOverdue =
              sale.dueDate && new Date(`${sale.dueDate}T23:59:59`) < new Date()
            return (
              <li key={sale.id} className={`balance-card ${isOverdue ? 'is-overdue' : ''}`}>
                <div className="balance-main">
                  <div>
                    <strong>{sale.customerName || 'Unnamed customer'}</strong>
                    <span>{sale.customerPhone || sale.receiptNumber}</span>
                  </div>
                  <strong className="balance-amount">{money(sale.balanceDue)}</strong>
                </div>
                <div className="balance-meta">
                  <span>{sale.receiptNumber}</span>
                  <span>{formatDateTime(sale.createdAt)}</span>
                  {sale.dueDate && <span className={isOverdue ? 'overdue-text' : ''}>Due {sale.dueDate}</span>}
                </div>
                <div className="balance-progress">
                  <span>Total {money(sale.total)}</span>
                  <span>Paid {money(sale.amountPaid)}</span>
                  <span className={`status-badge ${isOverdue ? 'overdue' : sale.paymentStatus}`}>
                    {isOverdue ? 'Overdue' : sale.paymentStatus === 'partial' ? 'Partially paid' : 'Due'}
                  </span>
                </div>
                <div className="balance-actions">
                  <button type="button" className="ghost-btn" onClick={() => setStatementSale(sale)}>
                    <FileText size={16} aria-hidden /> Statement
                  </button>
                  <button type="button" className="primary-btn" onClick={() => openPayment(sale)}>
                    Record payment
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      </div>

      {selected && (
        <ModalPortal onClose={closePayment}>
          <form
            className="modal panel"
            onSubmit={submitPayment}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-title"
          >
            <div className="modal-head">
              <div>
                <h2 id="payment-title">Record payment</h2>
                <p>{selected.customerName} · Balance {money(selected.balanceDue)}</p>
              </div>
              <button type="button" className="icon-btn" onClick={closePayment} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-content">
              <label>
                Amount
                <input
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
              <label>
                Payment method
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value as CollectedPaymentMethod)}
                >
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                </select>
              </label>
              <label>
                Note
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={closePayment}>Cancel</button>
              <button
                type="submit"
                className="primary-btn"
                disabled={
                  saving ||
                  !Number.isFinite(Number(amount)) ||
                  Number(amount) <= 0 ||
                  Number(amount) > selected.balanceDue
                }
              >
                {saving ? 'Saving…' : 'Save payment'}
              </button>
            </div>
          </form>
        </ModalPortal>
      )}

      {statementSale && (
        <ModalPortal onClose={() => setStatementSale(null)}>
          <section className="modal panel statement-modal" role="dialog" aria-modal="true" aria-labelledby="statement-title">
            <div className="modal-head no-print">
              <h2 id="statement-title">Customer statement</h2>
              <button type="button" className="icon-btn" onClick={() => setStatementSale(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div id="print-statement" className="statement-sheet">
              <header className="statement-head">
                <div><strong>PRINCE AMOFAH AUTOS</strong><StoreContact /><span>Customer account statement</span></div>
                <div><span>Statement date</span><strong>{new Date().toLocaleDateString()}</strong></div>
              </header>
              <div className="statement-customer">
                <strong>{statementSale.customerName || 'Unnamed customer'}</strong>
                {statementSale.customerPhone && <span>{statementSale.customerPhone}</span>}
              </div>
              <div className="statement-summary">
                <span>Current balance</span><strong>{money(statementBalance)}</strong>
              </div>
              <h3>Credit sales</h3>
              <div className="statement-table-wrap">
                <table className="statement-table">
                  <thead><tr><th>Date</th><th>Receipt</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead>
                  <tbody>{statementSales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{new Date(sale.createdAt).toLocaleDateString()}</td><td>{sale.receiptNumber}</td>
                      <td>{money(sale.total)}</td><td>{money(sale.amountPaid)}</td><td>{money(sale.balanceDue)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {statementPayments.length > 0 && (
                <><h3>Payments received</h3><ul className="statement-payment-list">
                  {statementPayments.map((payment) => <li key={payment.id}>
                    <span>{new Date(payment.createdAt).toLocaleDateString()} · {payment.paymentMethod}</span>
                    <strong>{payment.amount < 0 ? 'Refund ' : ''}{money(payment.amount)}</strong>
                  </li>)}
                </ul></>
              )}
              <p className="statement-thanks">Thank you for your business.</p>
            </div>
            <div className="modal-actions no-print">
              <button type="button" className="ghost-btn" onClick={() => setStatementSale(null)}>Close</button>
              <button type="button" className="primary-btn" onClick={() => window.print()}>
                <Printer size={16} aria-hidden /> Print statement
              </button>
            </div>
          </section>
        </ModalPortal>
      )}
    </div>
  )
}
