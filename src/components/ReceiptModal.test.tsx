import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ReceiptModal } from './ReceiptModal'
import type { Sale } from '../types'
vi.mock('./ModalPortal', () => ({ ModalPortal: ({ children }: { children: ReactNode }) => <>{children}</> }))
const item = { productId: 'sample', name: 'Sample item', qty: 2, price: 50, lineTotal: 100, sku: '', taxable: false, taxRate: 0, taxAmount: 0, lineSubtotal: 100, lineCost: 0, grossProfit: 0 }
const sale: Sale = {
  id: 'demo', receiptNumber: 'SAMPLE-001', items: [item], subtotal: 100, taxTotal: 0, total: 100,
  paymentMethod: 'credit', amountPaid: 0, balanceDue: 0, paymentStatus: 'voided',
  createdAt: '2026-09-24T12:00:00Z', workerId: null, workerName: 'Sample staff', customerId: null,
  customerName: 'Sample customer', customerPhone: '', vehicleInfo: '', dueDate: null, notes: '', costTotal: 0, grossProfit: 0,
  voidedAt: '2026-09-24T13:00:00Z', voidedBy: '00000000-0000-0000-0000-000000000001',
  voidReceipt: { receipt_number: 'VOID-SAMPLE-001', created_at: '2026-09-24T13:00:00Z', recorded_by: '00000000-0000-0000-0000-000000000001', recorded_by_name: 'Sample owner', reason: 'SAMPLE ONLY — customer cancelled', refund_amount: 60, payment_method: 'cash', original_sale: { items: [item], total: 100, amount_paid: 60, balance_due: 40 } },
}
describe('void receipt', () => {
  it('prints the captured refund and cancelled debt, not the total as refund', () => {
    const html = renderToStaticMarkup(<ReceiptModal sale={sale} onClose={() => {}} />)
    for (const text of ['VOID RECEIPT', 'VOID-SAMPLE-001', 'Sample owner', 'SAMPLE ONLY', '60.00', '40.00', 'View original receipt', 'NOT VALID FOR PAYMENT']) expect(html).toContain(text)

  })
  it('keeps the test warning inside the printed receipt', () => {
    const html = renderToStaticMarkup(<ReceiptModal sale={sale} testOnly onClose={() => {}} />)
    expect(html.slice(html.indexOf('id="print-receipt"'))).toContain('TEST ONLY — NOT A REAL SALE')
  })
  it('does not invent historical refund details', () => {
    const html = renderToStaticMarkup(<ReceiptModal sale={{ ...sale, voidReceipt: null }} onClose={() => {}} />)
    expect(html).toContain('Historical void: refund amount')
    expect(html).not.toContain('View original receipt')
  })
  it('leaves ordinary sale receipts unmarked', () => {
    const html = renderToStaticMarkup(<ReceiptModal sale={{ ...sale, voidedAt: null, voidReceipt: null }} onClose={() => {}} />)
    expect(html).toContain('Sales receipt')
    expect(html).not.toContain('VOID RECEIPT')
  })
})
