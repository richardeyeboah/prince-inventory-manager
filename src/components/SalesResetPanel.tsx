import { useRef, useState } from 'react'
import { useShop } from '../store'
import { money, formatDateTime } from '../lib/format'
import { salesPeriodBounds, type SalesPeriod } from '../lib/sales-period'

export function SalesResetPanel() {
  const { isOwner, sales, resets, resetSales, restoreReset, offlinePending } = useShop()
  const today = new Date().toISOString().slice(0,10)
  const [period,setPeriod] = useState<SalesPeriod>('month')
  const [month,setMonth] = useState(today.slice(0,7))
  const [year,setYear] = useState(today.slice(0,4))
  const [start,setStart] = useState(today)
  const [end,setEnd] = useState(today)
  const [reason,setReason] = useState('')
  const [confirmation,setConfirmation] = useState('')
  const [message,setMessage] = useState('')
  const [busy,setBusy] = useState(false)
  const lock = useRef(false)
  const requestId = useRef(crypto.randomUUID())
  const bounds = salesPeriodBounds(period,month,year,start,end)
  const selected = bounds ? sales.filter((s) => (!bounds.start || Date.parse(s.createdAt) >= Date.parse(bounds.start)) && (!bounds.end || Date.parse(s.createdAt) < Date.parse(bounds.end))) : []
  if (!isOwner) return null
  return <details className="return-form"><summary><strong>Reset sales totals · Owner only</strong></summary>
    <p>Start fresh for a month, year, custom period, or all dates. Sales and their payment entries move out of active totals into history. Stock, products, staff, customers, and unpaid balances stay intact. You can restore a reset below.</p>
    <form onSubmit={async (e) => {
      e.preventDefault()
      if (!bounds || !selected.length || confirmation !== 'RESET' || lock.current) return
      lock.current=true; setBusy(true); setMessage('')
      try {
        if (await resetSales(requestId.current,bounds.start,bounds.end,reason,selected.map((s) => s.id))) {
          setMessage(`${selected.length} sales moved to history. Active totals have been reset.`)
          setConfirmation(''); requestId.current=crypto.randomUUID()
        } else setMessage('Reset was not saved. Check the error above and review the period.')
      } catch { setMessage('Could not save. Check your connection and try again.') }
      finally {lock.current=false;setBusy(false)}
    }}>
      <fieldset disabled={busy}>
        <label>Period<select value={period} onChange={(e) => {setPeriod(e.target.value as SalesPeriod);setConfirmation('')}}><option value="month">Month</option><option value="year">Year</option><option value="custom">Custom dates</option><option value="all">All sales</option></select></label>
        {period==='month' && <label>Month<input type="month" required value={month} onChange={(e) => {setMonth(e.target.value);setConfirmation('')}} /></label>}
        {period==='year' && <label>Year<input type="number" min="1" max="9998" required value={year} onChange={(e) => {setYear(e.target.value);setConfirmation('')}} /></label>}
        {period==='custom' && <><label>From<input type="date" required value={start} onChange={(e) => {setStart(e.target.value);setConfirmation('')}} /></label><label>Through<input type="date" required value={end} onChange={(e) => {setEnd(e.target.value);setConfirmation('')}} /></label></>}
        <p aria-live="polite">{bounds ? `${selected.length} sales · ${money(selected.filter((s) => !s.voidedAt).reduce((n,s) => n+s.total,0))} sales revenue will leave active totals. Dates use Ghana time.` : 'Enter a valid date range.'}</p>
        <label>Reason<input required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Month closed / fresh start" maxLength={1000} /></label>
        <label>Type RESET to confirm<input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" /></label>
        {offlinePending>0 && <p>Wait for pending offline sales to sync before resetting.</p>}
        <button className="primary-btn" disabled={busy || !bounds || !selected.length || confirmation!=='RESET' || !reason.trim() || offlinePending>0}>{busy?'Saving…':'Reset selected sales totals'}</button>
      </fieldset>
    </form>
    {message && <p role="status">{message}</p>}
    {resets.length>0 && <h3>Reset history</h3>}
    {resets.map((r) => <div key={r.id}><p>{formatDateTime(r.created_at)} · {r.reason} · {r.sale_count} sales · {money(Number(r.sales_total))}{r.restored_at?' · Restored':''}</p>
      {!r.restored_at && <button type="button" className="ghost-btn" disabled={busy} onClick={async () => {
        if (lock.current) return
        lock.current=true;setBusy(true)
        try {setMessage(await restoreReset(r.id)?'Sales restored to active totals.':'Could not restore. Check the error above.')}
        catch {setMessage('Could not restore. Check your connection.')}
        finally {lock.current=false;setBusy(false)}
      }}>Restore these sales</button>}
    </div>)}
  </details>
}
