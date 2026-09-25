import { useRef, useState } from 'react'
import { useShop } from '../store'
import type { CollectedPaymentMethod, Sale } from '../types'
import { previewAdjustment } from '../lib/returns'
import { money } from '../lib/format'

export function ReturnForm({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { adjustSale, products } = useShop()
  const [index, setIndex] = useState(0)
  const [quantity, setQuantity] = useState(String(sale.items[0].qty))
  const [price, setPrice] = useState(String(sale.items[0].price))
  const [restock, setRestock] = useState(false)
  const [reason, setReason] = useState('')
  const [method, setMethod] = useState<CollectedPaymentMethod>('cash')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const pending = useRef(false)
  const requestId = useRef(crypto.randomUUID())
  const line = sale.items[index]
  const product = products.find((p) => p.id === line.productId)
  const preview = quantity.trim() && price.trim() ? previewAdjustment(sale, line, Number(quantity), Number(price)) : null
  const changed = Number(quantity) !== line.qty || Number(price) !== line.price
  return <form className="return-form" onSubmit={async (event) => {
    event.preventDefault()
    if (!preview || !changed || pending.current) return
    pending.current = true; setBusy(true); setFailed(false)
    try {
      const ok = await adjustSale({ id: requestId.current, saleId: sale.id, version: sale.adjustmentVersion ?? 0, lineNumber: index + 1,
        quantity: Number(quantity), unitPrice: Number(price), restock, reason, method })
      if (ok) onClose(); else setFailed(true)
    } catch { setFailed(true) }
    finally { pending.current = false; setBusy(false) }
  }}>
    <h3>Return or edit sold item</h3>
    <p>Reduce the quantity for a return, or correct the unit price. Use Checkout for additional items.</p>
    <fieldset disabled={busy}>
      <label>Item<select value={index} onChange={(e) => {
        const next = Number(e.target.value); setIndex(next); setQuantity(String(sale.items[next].qty)); setPrice(String(sale.items[next].price)); setRestock(false)
      }}>{sale.items.map((item, n) => <option key={n} value={n}>{item.name} · {item.qty} remaining</option>)}</select></label>
      <label>Quantity customer keeps<input type="number" min="0" max={line.qty} step="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
      <label>Corrected unit price, before tax<input type="number" min="0" max="99999999" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} /></label>
      {product && !product.isLabor && <label><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Put returned items back in available stock</label>}
      <label>Reason<input required maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Returned unused / damaged / price correction" /></label>
      <label>Refund method<select value={method} onChange={(e) => setMethod(e.target.value as CollectedPaymentMethod)}>
        <option value="cash">Cash</option><option value="mobile_money">Mobile Money</option><option value="card">Card</option><option value="transfer">Transfer</option>
      </select></label>
      {preview && <p aria-live="polite">Returning {preview.removed} · Revised sale {money(preview.saleTotal)} · Give customer back <strong>{money(preview.refund)}</strong> · Balance due {money(preview.balance)}</p>}
      <p>This records money you have returned; it does not send a payment. Unpaid balances are reduced first.</p>
      {failed && <p role="alert">Could not save. Check the error above. If the sale changed, close and reopen this form.</p>}
      <div className="sale-actions"><button className="primary-btn" disabled={!preview || !changed || !reason.trim()}>{busy ? 'Saving…' : 'Record adjustment and refund'}</button><button type="button" className="ghost-btn" onClick={onClose}>Cancel</button></div>
    </fieldset>
  </form>
}
