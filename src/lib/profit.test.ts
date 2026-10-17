import { describe, expect, it } from 'vitest'
import { applyStartDay, profitByDay, profitRangeBounds, profitSeries, saleMissingCost, summarizeProfit, unpaidProfitOf } from './profit'
import type { Sale, SaleLine } from '../types'

function sale(id: string, createdAt: string, total: number, cost: number, voidedAt: string | null = null, balanceDue = 0): Sale {
  return {
    id, receiptNumber: id, total, subtotal: total, taxTotal: 0, costTotal: cost, grossProfit: total - cost,
    balanceDue, amountPaid: total - balanceDue, paymentStatus: balanceDue ? 'partial' : 'paid', paymentMethod: 'cash', workerId: 'w', workerName: 'Owner',
    customerId: null, customerName: '', customerPhone: '', vehicleInfo: '', dueDate: null, notes: '', items: [],
    createdAt, voidedAt, voidedBy: null,
  }
}

function line(productId: string, lineTotal: number, lineCost: number): SaleLine {
  return { productId, name: productId, sku: '', price: lineTotal, qty: 1, taxable: false, taxRate: 0, taxAmount: 0, lineSubtotal: lineTotal, lineTotal, lineCost, grossProfit: lineTotal - lineCost }
}

const sales = [
  sale('a', '2026-09-24T09:00:00Z', 100, 60),
  sale('b', '2026-09-24T23:30:00-05:00', 50, 20), // 04:30 Ghana time on 25 Sep
  sale('c', '2026-09-10T12:00:00Z', 200, 150),
  sale('void', '2026-09-24T10:00:00Z', 999, 1, '2026-09-24T11:00:00Z'),
  sale('aug', '2026-08-31T22:00:00Z', 80, 30),
]

describe('profit by shop day', () => {
  it('groups by Ghana day and ignores voided sales', () => {
    const days = profitByDay(sales)
    expect(days.get('2026-09-24')).toMatchObject({ receipts: 1, sales: 100, cost: 60, profit: 40 })
    expect(days.get('2026-09-25')).toMatchObject({ receipts: 1, sales: 50, profit: 30 })
    expect(days.has('void')).toBe(false)
  })
  it('summarizes a month with margin and newest day first', () => {
    const bounds = profitRangeBounds('pickMonth', { month: '2026-09' })!
    const summary = summarizeProfit(sales, bounds.startDay, bounds.endDay)
    expect(summary).toMatchObject({ startDay: '2026-09-01', endDay: '2026-09-30', receipts: 3, sales: 350, cost: 230, profit: 120 })
    expect(summary.margin).toBeCloseTo(120 / 350)
    expect(summary.days.map((d) => d.day)).toEqual(['2026-09-25', '2026-09-24', '2026-09-10'])
  })
  it('computes today, 7 day, month-to-date and year bounds from shop time', () => {
    const now = '2026-09-24T23:30:00-05:00' // already 25 Sep in Ghana
    expect(profitRangeBounds('today', {}, now)).toEqual({ startDay: '2026-09-25', endDay: '2026-09-25' })
    expect(profitRangeBounds('7d', {}, now)).toEqual({ startDay: '2026-09-19', endDay: '2026-09-25' })
    expect(profitRangeBounds('month', {}, now)).toEqual({ startDay: '2026-09-01', endDay: '2026-09-25' })
    expect(profitRangeBounds('year', {}, now)).toEqual({ startDay: '2026-01-01', endDay: '2026-09-25' })
  })
  it('caps the current month at today but keeps full past months', () => {
    expect(profitRangeBounds('pickMonth', { month: '2026-09' }, '2026-09-24T12:00:00Z')).toEqual({ startDay: '2026-09-01', endDay: '2026-09-24' })
    expect(profitRangeBounds('pickMonth', { month: '2026-08' }, '2026-09-24T12:00:00Z')).toEqual({ startDay: '2026-08-01', endDay: '2026-08-31' })
  })
  it('rejects incomplete or reversed custom ranges', () => {
    expect(profitRangeBounds('custom', { start: '2026-09-10', end: '2026-09-01' })).toBeNull()
    expect(profitRangeBounds('custom', { start: '2026-09-31', end: '2026-10-01' })).toBeNull()
    expect(profitRangeBounds('pickMonth', { month: '2026-13' })).toBeNull()
    expect(profitRangeBounds('custom', { start: '2026-08-31', end: '2026-09-24' })).toEqual({ startDay: '2026-08-31', endDay: '2026-09-24' })
  })
  it('separates profit still owed on credit from realised profit', () => {
    const credit = sale('credit', '2026-09-24T09:00:00Z', 200, 120, null, 50) // 25% unpaid → 25% of 80 profit
    expect(unpaidProfitOf(credit)).toBe(20)
    expect(unpaidProfitOf(sale('paid', '2026-09-24T09:00:00Z', 100, 60))).toBe(0)
    const summary = summarizeProfit([credit, sale('a', '2026-09-24T10:00:00Z', 100, 60)], '2026-09-24', '2026-09-24')
    expect(summary).toMatchObject({ profit: 120, unpaid: 50, unpaidProfit: 20, realisedProfit: 100 })
    expect(summary.days[0]).toMatchObject({ unpaid: 50, unpaidProfit: 20 })
  })
  it('flags receipts that sold a part with no cost price but ignores labor', () => {
    const noCost = { ...sale('x', '2026-09-24T09:00:00Z', 100, 0), items: [line('part', 100, 0)] }
    const labor = { ...sale('y', '2026-09-24T09:00:00Z', 50, 0), items: [line('labor', 50, 0)] }
    const fine = { ...sale('z', '2026-09-24T09:00:00Z', 80, 30), items: [line('part', 80, 30)] }
    const laborIds = new Set(['labor'])
    expect(saleMissingCost(noCost, laborIds)).toBe(true)
    expect(saleMissingCost(labor, laborIds)).toBe(false)
    expect(saleMissingCost(fine, laborIds)).toBe(false)
    expect(summarizeProfit([noCost, labor, fine], '2026-09-24', '2026-09-24', laborIds).missingCost).toBe(1)
  })
  it('clips ranges to the chosen profit start day without touching the data', () => {
    expect(applyStartDay({ startDay: '2026-09-01', endDay: '2026-09-30' }, '2026-09-15')).toEqual({ startDay: '2026-09-15', endDay: '2026-09-30' })
    expect(applyStartDay({ startDay: '2026-09-01', endDay: '2026-09-30' }, '2026-08-01')).toEqual({ startDay: '2026-09-01', endDay: '2026-09-30' })
    expect(applyStartDay({ startDay: '2026-09-01', endDay: '2026-09-30' }, '2026-10-01')).toBeNull()
    expect(applyStartDay({ startDay: '2026-09-01', endDay: '2026-09-30' }, null)).toEqual({ startDay: '2026-09-01', endDay: '2026-09-30' })
  })
  it('fills empty days in the chart series oldest first', () => {
    const summary = summarizeProfit(sales, '2026-09-22', '2026-09-25')
    const series = profitSeries(summary)
    expect(series.map((d) => d.day)).toEqual(['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'])
    expect(series[0].profit).toBe(0)
    expect(series[3].profit).toBe(30)
  })
})
