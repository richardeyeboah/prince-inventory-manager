import { roundMoney } from './finance'
import type { Sale, SaleLine } from '../types'

export function previewAdjustment(sale: Sale, line: SaleLine, quantity: number, price: number) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > line.qty || !Number.isFinite(price) || price < 0) return null
  const subtotal = roundMoney(quantity * roundMoney(price))
  const total = roundMoney(subtotal + roundMoney(subtotal * line.taxRate))
  const saleTotal = roundMoney(sale.total - line.lineTotal + total)
  const refund = roundMoney(Math.max(0, sale.amountPaid - saleTotal))
  return { saleTotal, refund, balance: roundMoney(Math.max(0, saleTotal - sale.amountPaid)), removed: line.qty - quantity }
}
