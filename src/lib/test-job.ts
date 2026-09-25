import type { Sale } from '../types'
export type TestReceiptKind = 'sale' | 'credit' | 'void'
export function makeTestJob(kind: TestReceiptKind, now: string): Sale {
  const items = [
    { productId: 'sample-oil', name: 'Engine oil · sample', sku: 'TEST-01', qty: 2, price: 85, taxable: false, taxRate: 0, taxAmount: 0, lineSubtotal: 170, lineTotal: 170, lineCost: 0, grossProfit: 0 },
    { productId: 'sample-filter', name: 'Oil filter · sample', sku: 'TEST-02', qty: 1, price: 45, taxable: false, taxRate: 0, taxAmount: 0, lineSubtotal: 45, lineTotal: 45, lineCost: 0, grossProfit: 0 },
  ]
  return {
    id: 'test-job-preview', receiptNumber: 'TEST-ONLY-001', items, subtotal: 215, taxTotal: 0, total: 215,
    paymentMethod: kind === 'credit' ? 'credit' : 'cash', amountPaid: kind === 'void' ? 0 : kind === 'credit' ? 100 : 215,
    balanceDue: kind === 'credit' ? 115 : 0, paymentStatus: kind === 'void' ? 'voided' : kind === 'credit' ? 'partial' : 'paid',
    createdAt: now, workerId: null, workerName: 'Test staff', customerId: null, customerName: 'Sample customer', customerPhone: '', vehicleInfo: '', dueDate: null, notes: '', costTotal: 0, grossProfit: 0,
    voidedAt: kind === 'void' ? now : null, voidedBy: kind === 'void' ? 'TEST-OWNER' : null,
    voidReceipt: kind === 'void' ? { receipt_number: 'VOID-TEST-ONLY-001', created_at: now, recorded_by: 'TEST-OWNER', recorded_by_name: 'Test owner', reason: 'Testing the void receipt appearance', refund_amount: 215, payment_method: 'cash', original_sale: { items, total: 215, amount_paid: 215, balance_due: 0 } } : null,
  }
}
