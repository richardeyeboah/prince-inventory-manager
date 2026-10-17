import type { Payment, Product, Sale } from '../types'
import { calculateLine, roundMoney } from './finance'
import { shopDayKey } from './sales-calendar'

const DAY_MS = 24 * 60 * 60 * 1000

export function finalCustomerPrice(product: Pick<Product, 'price' | 'taxable' | 'taxRate'>) {
  return calculateLine({
    unitPrice: product.price,
    unitCost: 0,
    quantity: 1,
    applyTax: product.taxable,
    taxRate: product.taxRate,
  }).total
}

export function summarizeInventory(products: Product[]) {
  const stockProducts = products.filter((product) => !product.isLabor)
  const totals = stockProducts.reduce(
    (summary, product) => {
      const quantity = Math.max(0, product.stock)
      const value = calculateLine({
        unitPrice: product.price,
        unitCost: product.costPrice,
        quantity,
        applyTax: product.taxable,
        taxRate: product.taxRate,
      })
      summary.units += quantity
      summary.costValue = roundMoney(summary.costValue + value.cost)
      summary.salesValue = roundMoney(summary.salesValue + value.total)
      summary.expectedProfit = roundMoney(summary.expectedProfit + value.grossProfit)
      return summary
    },
    { units: 0, costValue: 0, salesValue: 0, expectedProfit: 0 },
  )
  const lowStock = stockProducts.filter((product) => product.stock > 0 && product.stock <= product.lowStockAt)
  const outOfStock = stockProducts.filter((product) => product.stock <= 0)
  return {
    ...totals,
    products: products.length,
    stockedProducts: stockProducts.length,
    services: products.length - stockProducts.length,
    lowStock: lowStock.length,
    outOfStock: outOfStock.length,
    needsAttention: lowStock.length + outOfStock.length,
  }
}

export function summarizeStore(products: Product[], sales: Sale[], payments: Payment[], now = new Date()) {
  // All dashboard days follow Ghana shop time so figures match the Sales calendar.
  const today = shopDayKey(now)
  const active = sales.filter((sale) => !sale.voidedAt)
  const dayOf = (sale: Sale) => shopDayKey(sale.createdAt)
  const todays = active.filter((sale) => dayOf(sale) === today)
  const series = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now.getTime() - (6 - i) * DAY_MS)
    const key = shopDayKey(day)
    return { key, label: i === 6 ? 'Today' : day.toLocaleDateString('en-GH', { weekday: 'short', timeZone: 'Africa/Accra' }), total: active.filter((s) => dayOf(s) === key).reduce((sum, s) => sum + s.total, 0) }
  })
  const sold = new Map<string, { id: string; name: string; qty: number; total: number }>()
  for (const sale of active.filter((s) => dayOf(s) >= series[0].key && dayOf(s) <= today)) {
    for (const line of sale.items) {
      const item = sold.get(line.productId) ?? { id: line.productId, name: line.name, qty: 0, total: 0 }
      item.qty += line.qty; item.total += line.lineTotal; sold.set(line.productId, item)
    }
  }
  const byMethod = { cash: 0, mobile_money: 0, card: 0, transfer: 0 }
  for (const payment of payments) {
    if (!payment.reversedAt && shopDayKey(payment.createdAt) === today) byMethod[payment.paymentMethod] += payment.amount
  }
  return {
    salesToday: todays.reduce((sum, sale) => sum + sale.total, 0), countToday: todays.length,
    profitToday: todays.reduce((sum, sale) => sum + sale.grossProfit, 0),
    balance: active.reduce((sum, sale) => sum + sale.balanceDue, 0),
    collected: Object.values(byMethod).reduce((sum, amount) => sum + amount, 0), byMethod,
    low: products.filter((p) => !p.isLabor && p.stock <= p.lowStockAt).sort((a, b) => a.stock - b.stock),
    series, top: [...sold.values()].sort((a,b) => b.qty - a.qty).slice(0,5),
    recent: [...active].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,5),
  }
}
