import { ArrowUpRight, Plus, Package, ShoppingBag } from 'lucide-react'
import { formatDateTime, money } from '../lib/format'
import { summarizeStore } from '../lib/store-summary'
import { useShop } from '../store'
import { useAuth } from '../auth'

type Props = { onNavigate: (tab: 'sell' | 'stock' | 'sales' | 'credit') => void }

export function DashboardView({ onNavigate }: Props) {
  const { products, sales, allSales, payments, isOwner, offlinePending } = useShop()
  const { profile } = useAuth()
  const visibleSales = isOwner ? sales : sales.filter((sale) => sale.workerId === profile?.id)
  const visiblePayments = isOwner ? payments : payments.filter((payment) => payment.recordedBy === profile?.id)
  const data = summarizeStore(products, visibleSales, visiblePayments)
  const sharedBalance = allSales.filter((sale) => !sale.voidedAt).reduce((sum, sale) => sum + sale.balanceDue, 0)
  const max = Math.max(1, ...data.series.map((day) => day.total))
  return <div className="view dashboard-view">
    <header className="view-header">
      <div><p className="eyebrow">{isOwner ? 'SHOP OVERVIEW' : 'MY DAY'}</p><h1>{isOwner ? 'Today at the shop' : 'My daily revenue'}</h1><p className="page-description">{isOwner ? 'Sales, stock and the details that need your attention.' : 'Your sales and payments collected today.'}</p></div>
      <button className="primary-btn" onClick={() => onNavigate('sell')}><Plus size={18} /> New sale</button>
    </header>
    <div className="retail-metrics">
      <button className="retail-metric metric-featured" disabled={!isOwner} onClick={() => isOwner && onNavigate('sales')}><span>{isOwner ? 'Sales today' : 'My revenue today'} {isOwner && <ArrowUpRight size={18}/>}</span><strong>{money(data.salesToday)}</strong><small>{data.countToday} completed sales · including tax</small></button>
      <button className="retail-metric" disabled={!isOwner} onClick={() => isOwner && onNavigate('sales')}><span>{isOwner ? 'Gross profit today' : 'Payments I collected'} {isOwner && <ArrowUpRight size={18}/>}</span><strong>{money(isOwner ? data.profitToday : data.collected)}</strong><small>{isOwner ? 'Before operating expenses' : 'Money you received today'}</small></button>
      <button className="retail-metric" onClick={() => onNavigate('credit')}><span>Customer balances <ArrowUpRight size={18}/></span><strong>{money(sharedBalance)}</strong><small>Outstanding across all sales</small></button>
      {isOwner && <button className="retail-metric" onClick={() => onNavigate('stock')}><span>Needs restocking <ArrowUpRight size={18}/></span><strong>{data.low.length}<em>products</em></strong><small>{data.low.filter((p) => p.stock === 0).length} currently out of stock</small></button>}
    </div>
    {offlinePending > 0 && <p className="offline-banner">{offlinePending} offline sales waiting to sync.</p>}
    {isOwner && !products.length && <section className="setup-strip"><span className="setup-icon"><Package size={24}/></span><div><h2>Start with your first product</h2><p>Add your catalog and opening stock to begin selling.</p></div><button className="ghost-btn" onClick={() => onNavigate('stock')}>Open products <ArrowUpRight size={17}/></button></section>}
    <div className="retail-dashboard-grid">
      <section className="card sales-trend">
        <div className="card-head"><div><h2>Sales activity</h2><p className="card-caption">Last 7 days · GHS</p></div><strong>{money(data.series.reduce((sum, day) => sum + day.total, 0))}</strong></div>
        <div className="retail-chart" role="img" aria-label={data.series.map((day) => day.label + ': ' + money(day.total)).join(', ')}>
          {data.series.map((day) => <div key={day.key} className="retail-chart-day"><span className="chart-amount">{money(day.total)}</span><div className="chart-track"><div className={day.label === 'Today' ? 'chart-bar chart-current' : 'chart-bar'} style={{height: (day.total ? Math.max(2, day.total / max * 100) : 0) + '%'}}/></div><span>{day.label}</span></div>)}
        </div>
      </section>
      <section className="card collection-card"><div className="card-head"><h2>Payments today</h2><span className="neutral-pill">Received</span></div><strong className="collection-total">{money(data.collected)}</strong><p className="card-caption">Includes payments toward earlier credit sales.</p><ul className="retail-payment-list">{Object.entries(data.byMethod).filter(([method, total]) => method === 'cash' || method === 'mobile_money' || total > 0).map(([method,total]) => <li key={method}><span>{method === 'mobile_money' ? 'Mobile Money' : method === 'transfer' ? 'Transfer' : method === 'cash' ? 'Cash' : 'Card'}</span><strong>{money(total)}</strong></li>)}</ul></section>
      <section className="card"><div className="card-head"><h2>Best sellers</h2><span className="card-caption">Last 7 days</span></div>{data.top.length ? <ol className="retail-ranked-list">{data.top.map((item, i) => <li key={item.id}><span className="rank-number">{String(i+1).padStart(2,'0')}</span><div><strong>{item.name}</strong><small>{item.qty} sold</small></div><strong>{money(item.total)}</strong></li>)}</ol> : <div className="retail-empty compact"><ShoppingBag size={28}/><h3>Your best sellers will appear here</h3><p>Record sales to see what customers buy most.</p></div>}</section>
      {isOwner && <section className="card"><div className="card-head"><h2>Stock attention</h2><button className="link-btn" onClick={() => onNavigate('stock')}>View inventory <ArrowUpRight size={16}/></button></div>{data.low.length ? <ul className="retail-stock-alerts">{data.low.slice(0,5).map((p) => <li key={p.id}><div><strong>{p.name}</strong><small>{p.sku}{p.shelfLocation ? ' · Shelf ' + p.shelfLocation : ''}</small></div><span className="stock-warning">{p.stock === 0 ? 'Out of stock' : p.stock + ' left'}</span></li>)}</ul> : <div className="retail-empty compact"><Package size={28}/><h3>{products.length ? 'Stock levels look good' : 'No products to track yet'}</h3><p>{products.length ? 'Products below their stock threshold will appear here.' : 'Set a low-stock threshold when adding products.'}</p></div>}</section>}
      <section className="card retail-recent"><div className="card-head"><h2>{isOwner ? 'Recent sales' : 'My recent sales'}</h2>{isOwner && <button className="link-btn" onClick={() => onNavigate('sales')}>All sales <ArrowUpRight size={16}/></button>}</div>{data.recent.length ? <ul className="recent-list">{data.recent.map((sale) => <li key={sale.id}><div className="recent-main"><strong>{sale.customerName || 'Walk-in customer'}</strong><span className="recent-meta">{sale.receiptNumber} · {formatDateTime(sale.createdAt)}</span></div><span className={'status-badge ' + sale.paymentStatus}>{sale.paymentStatus}</span><strong>{money(sale.total)}</strong></li>)}</ul> : <p className="retail-recent-empty">No sales yet. Your transactions will appear here as you sell.</p>}</section>
    </div>
  </div>
}
