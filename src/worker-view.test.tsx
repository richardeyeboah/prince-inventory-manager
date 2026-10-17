import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payment, Product, Profile, Sale } from './types'

// A worker (Kwame) and a colleague (Ama) sold today. Profit/cost values are deliberately
// non-zero so the test proves the screens hide them rather than merely having nothing to show.
const auth = vi.hoisted(() => ({
  session: { user: { id: 'w1' } }, profile: { id: 'w1', displayName: 'Kwame', role: 'worker', createdAt: '' } as Profile,
  isOwner: false, loading: false, error: null, signOut: vi.fn(), updateDisplayName: vi.fn(),
}))
const shop = vi.hoisted(() => ({ value: null as unknown as Record<string, unknown> }))
vi.mock('./auth', () => ({ useAuth: () => auth, AuthProvider: ({ children }: { children: ReactNode }) => children }))
vi.mock('./lib/supabase', () => ({ supabase: { rpc: vi.fn() }, supabaseConfigured: true }))
vi.mock('./store', () => ({ useShop: () => shop.value, ShopProvider: ({ children }: { children: ReactNode }) => children }))

import { DashboardView } from './components/DashboardView'
import { SellView } from './components/SellView'
import { SalesView } from './components/SalesView'
import { CreditView } from './components/CreditView'

const now = new Date().toISOString()
const product = (id: string, name: string, price: number) => ({
  id, name, sku: 'SKU-' + id, price, costPrice: 40, stock: 5, lowStockAt: 2, taxable: true, taxRate: 0.15, isLabor: false, category: '', shelfLocation: '', createdAt: now,
}) as unknown as Product
const sale = (id: string, workerId: string, workerName: string, total: number, balanceDue = 0): Sale => ({
  id, receiptNumber: 'R' + id, total, subtotal: total / 1.15, taxTotal: total - total / 1.15, costTotal: 40, grossProfit: total - 40,
  balanceDue, amountPaid: total - balanceDue, paymentStatus: balanceDue ? 'partial' : 'paid', paymentMethod: balanceDue ? 'credit' : 'cash',
  workerId, workerName, customerId: null, customerName: 'Customer ' + id, customerPhone: '', vehicleInfo: '', dueDate: null, notes: '',
  createdAt: now, voidedAt: null, voidedBy: null,
  items: [{ productId: 'p1', name: 'Brake pad', sku: 'SKU-p1', price: total, qty: 1, taxable: true, taxRate: 0.15, taxAmount: total - total / 1.15, lineSubtotal: total / 1.15, lineTotal: total, lineCost: 40, grossProfit: total - 40 }],
})
const payment = (id: string, saleId: string, recordedBy: string, amount: number) => ({
  id, saleId, amount, paymentMethod: 'cash', recordedBy, createdAt: now, notes: '', reversedAt: null,
}) as unknown as Payment

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

beforeEach(() => {
  const sales = [sale('1', 'w1', 'Kwame', 100), sale('2', 'w2', 'Ama', 250, 50), sale('3', 'w1', 'Kwame', 30)]
  const payments = [payment('a', '1', 'w1', 100), payment('b', '2', 'w2', 200), payment('c', '3', 'w1', 30)]
  shop.value = {
    products: [product('p1', 'Brake pad', 100)], sales, allSales: sales, payments, allPayments: payments,
    customers: [], resets: [], adjustments: [], offlinePending: 0, isOwner: false, loading: false, error: null,
    checkout: vi.fn(), recordPayment: vi.fn(), refresh: vi.fn(), voidSale: vi.fn(), adjustSale: vi.fn(),
  }
})

describe('what a worker sees', () => {
  it('never shows profit, cost or tax on any worker screen', () => {
    const views = [() => <DashboardView onNavigate={() => {}} />, () => <SellView />, () => <SalesView />, () => <CreditView />]
    for (const View of views) {
      const t = text(renderToStaticMarkup(<View />))
      expect(t).not.toMatch(/profit|cost|margin|\bTax\b|Subtotal/i)
    }
  })
  it('reports the same personal revenue on the dashboard and the Sales tab', () => {
    const dashboard = text(renderToStaticMarkup(<DashboardView onNavigate={() => {}} />))
    expect(dashboard).toContain('My revenue today GH₵130.00')
    expect(dashboard).toContain('My sales activity')
    expect(dashboard).toContain('Payments I collected today')
    expect(dashboard).toContain('My best sellers')
    expect(dashboard).not.toContain('GH₵380')

    const sales = text(renderToStaticMarkup(<SalesView />))
    expect(sales).toContain('2 of my receipts')
    expect(sales).toContain('GH₵130.00 my sales after returns')
    expect(sales).not.toContain('Sold by Ama')
    expect(sales).not.toContain('reset history')
    expect(sales).toContain('All shop receipts')
  })
  it('lets a worker see every customer balance so any staff member can take a payment', () => {
    const credit = text(renderToStaticMarkup(<CreditView />))
    expect(credit).toContain('Outstanding GH₵50.00')
    expect(credit).toContain('Record payment')
  })
})
