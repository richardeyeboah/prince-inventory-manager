import { useState, type ReactNode } from 'react'
import { Printer, X } from 'lucide-react'
import { money } from '../lib/format'
import type { Sale } from '../types'
import { ModalPortal } from './ModalPortal'
import { StoreContact } from './StoreContact'

const methodLabel = {
  cash: 'Cash', mobile_money: 'Mobile Money',
  card: 'Card',
  transfer: 'Transfer',
  credit: 'Credit / Pay later',
} as const

type Props = {
  sale: Sale
  onClose: () => void
  testOnly?: boolean
  previewControls?: ReactNode
}

export function ReceiptModal({ sale, onClose, testOnly = false, previewControls }: Props) {
  const [original, setOriginal] = useState(false)
  const audit = sale.voidReceipt
  const snapshot = audit?.original_sale
  const items = snapshot?.items ?? sale.items
  const total = snapshot?.total ?? sale.total
  const title = sale.voidedAt ? (original ? 'Original receipt · archived copy' : 'VOID RECEIPT') : 'Sales receipt'
  function printReceipt() {
    window.print()
  }

  return (
    <ModalPortal onClose={onClose} className="receipt-backdrop">
      <div
        className={`modal panel receipt-modal ${previewControls ? 'receipt-preview-modal' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
      >
        <div className="modal-head no-print">
          <h2 id="receipt-title">{testOnly ? 'Test job' : title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {previewControls && <div className="no-print">{previewControls}</div>}
        <div className="receipt-body" id="print-receipt">
          {testOnly && <p className="receipt-test-banner">TEST ONLY — NOT A REAL SALE</p>}
          <header className="receipt-header">
            <img className="receipt-logo" src="/brand/maa-thess-receipt.jpeg" alt="MAA THESS Memorial Enterprise" width="1280" height="562" />
            <StoreContact />
            <span className="document-label">{title} · GHS</span>
          </header>
          <dl className="receipt-details">
            {Boolean(sale.adjustmentVersion) && <div><dt>Adjusted receipt</dt><dd>Revision {sale.adjustmentVersion} · Net amounts after returns</dd></div>}
            <div><dt>Receipt no.</dt><dd>{sale.voidedAt && !original && audit ? audit.receipt_number : sale.receiptNumber}</dd></div>
            <div><dt>Date</dt><dd>{new Date(sale.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd></div>
            <div><dt>Customer</dt><dd>{sale.customerName || 'Walk-in customer'}</dd></div>
            <div><dt>Sold by</dt><dd>{sale.workerName || 'Shop staff'}</dd></div>
            <div><dt>Payment</dt><dd>{methodLabel[sale.paymentMethod]}</dd></div>
          </dl>
          {sale.voidedAt && <>
            <p className="receipt-voided">VOID — NOT VALID FOR PAYMENT</p>
            {!original && <dl className="receipt-details void-audit">
              <div><dt>Original receipt</dt><dd>{sale.receiptNumber}</dd></div>
              <div><dt>Voided at</dt><dd>{new Date(audit?.created_at ?? sale.voidedAt).toLocaleString('en-GB')}</dd></div>
              <div><dt>Voided by</dt><dd>{audit?.recorded_by_name ?? sale.voidedBy ?? 'Not recorded'}</dd></div>
              {audit && <div><dt>Staff ID</dt><dd>{audit.recorded_by}</dd></div>}
              <div><dt>Reason</dt><dd>{audit?.reason ?? 'Not recorded for this historical void'}</dd></div>
            </dl>}
          </>}
          <div className="receipt-column-head"><span>Item / Qty × unit price</span><span>Amount</span></div>

          <ul className="receipt-lines">
            {items.map((item, index) => (
              <li key={`${item.productId}:${index}`}>
                <span className="receipt-item-name">
                  <strong>{item.name}</strong>
                  <small>{item.qty} × {money(item.qty > 0 ? item.lineTotal / item.qty : item.price)}</small>
                </span>
                <span>{money(item.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <div className="receipt-total">
            <span>{sale.voidedAt ? 'Original total (GHS)' : 'Total (GHS)'}</span>
            <strong>{money(total)}</strong>
          </div>
          {!sale.voidedAt && sale.paymentMethod === 'credit' && (
            <div className="receipt-breakdown">
              <p><span>Paid</span><span>{money(sale.amountPaid)}</span></p>
              <p className="receipt-balance"><span>Balance due</span><strong>{money(sale.balanceDue)}</strong></p>
              {sale.dueDate && <p><span>Due date</span><span>{sale.dueDate}</span></p>}
            </div>
          )}

          {sale.voidedAt && <div className="receipt-breakdown">
            {audit ? original ? <>
              <p><span>Paid before void</span><span>{money(Number(snapshot!.amount_paid))}</span></p>
              <p><span>Balance before void</span><span>{money(Number(snapshot!.balance_due))}</span></p>
            </> : <>
              <p><span>Refund recorded</span><strong>{money(Number(audit.refund_amount))}</strong></p>
              <p><span>Refund method</span><span>{Number(audit.refund_amount) > 0 ? methodLabel[audit.payment_method] : 'No money refunded'}</span></p>
              <p><span>Unpaid balance cancelled</span><span>{money(Number(snapshot!.balance_due))}</span></p>
              <p><span>Balance due</span><strong>{money(0)}</strong></p>
              <p>All items above were voided. Refund recording does not send money.</p>
            </> : <p>Historical void: refund amount, method and original payment balance were not captured. No refund amount is inferred.</p>}
          </div>}
          <footer className="receipt-footer">
            <p className="receipt-thanks">{sale.voidedAt ? 'Original sale retained in history. This sale is void.' : 'Thank you for shopping with us.'}</p>
            <p>MAA THESS Memorial Enterprise</p>
            <p>Please keep this receipt for your records.</p>
          </footer>
        </div>

        <div className="modal-actions no-print">
          {sale.voidedAt && audit && <button type="button" className="ghost-btn" onClick={() => setOriginal(!original)}>{original ? 'View void receipt' : 'View original receipt'}</button>}
          <button type="button" className="ghost-btn" onClick={onClose}>
            Done
          </button>
          <button type="button" className="primary-btn" onClick={printReceipt}>
            <Printer size={18} aria-hidden />
            Print
          </button>
        </div>
      </div>
    </ModalPortal>
  )
}
