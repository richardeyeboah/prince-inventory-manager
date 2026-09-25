import { useRef, useState } from 'react'
import { useShop } from '../store'
import { money } from '../lib/format'
import type { CollectedPaymentMethod, Sale } from '../types'

export function VoidForm({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { voidSale } = useShop()
  const [reason, setReason] = useState('')
  const [method, setMethod] = useState<CollectedPaymentMethod>(sale.paymentMethod === 'credit' ? 'cash' : sale.paymentMethod)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  return <form className="return-form" onSubmit={async (event) => {
    event.preventDefault()
    if (lock.current || !reason.trim()) return
    lock.current = true; setBusy(true); setError('')
    try {
      if (await voidSale(sale.id, reason, method, sale.amountPaid)) onClose()
      else setError('Void was not confirmed. Check the error above and review the sale before retrying.')
    } catch { setError('Could not confirm the void. Check your connection and retry safely.') }
    finally { lock.current = false; setBusy(false) }
  }}>
    <fieldset disabled={busy}>
      <legend>Void sale {sale.receiptNumber}</legend>
      <p>Refund to record: <strong>{money(sale.amountPaid)}</strong>. Cancel unpaid balance: {money(sale.balanceDue)}. Available stock items return to inventory.</p>
      <label>Reason<input required value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <label>Refund method<select value={method} onChange={(e) => setMethod(e.target.value as CollectedPaymentMethod)}>
        <option value="cash">Cash</option><option value="mobile_money">Mobile Money</option><option value="card">Card</option><option value="transfer">Transfer</option>
      </select></label>
      <p>This records a refund you have made; it does not send money. The original receipt and void audit record are retained.</p>
      {error && <p role="alert">{error}</p>}
      <div className="sale-actions"><button className="primary-btn" disabled={!reason.trim()}>{busy ? 'Saving…' : 'Confirm void and recorded refund'}</button><button type="button" className="ghost-btn" onClick={onClose}>Cancel</button></div>
    </fieldset>
  </form>
}
