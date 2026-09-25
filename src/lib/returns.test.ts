import { describe, expect, it } from 'vitest'
import { previewAdjustment } from './returns'
import type { Sale, SaleLine } from '../types'
const line = { qty: 3, price: 10, lineTotal: 36, taxRate: 0.2 } as SaleLine
const sale = { total: 36, amountPaid: 36 } as Sale

describe('sale adjustment preview', () => {
  it('refunds a taxed partial return', () => {
    expect(previewAdjustment(sale,line,2,10)).toEqual({ saleTotal:24,refund:12,balance:0,removed:1 })
  })
  it('reduces debt before refunding collected money', () => {
    expect(previewAdjustment({...sale,amountPaid:10},line,2,10)).toEqual({saleTotal:24,refund:0,balance:14,removed:1})
    expect(previewAdjustment({...sale,amountPaid:30},line,2,10)?.refund).toBe(6)
  })
  it('refunds a full return and price-only correction', () => {
    expect(previewAdjustment(sale,line,0,10)?.refund).toBe(36)
    expect(previewAdjustment(sale,line,3,5)?.refund).toBe(18)
  })
  it('creates a balance for an upward price correction', () => {
    expect(previewAdjustment(sale,line,3,11)?.balance).toBe(3.6)
  })
  it('rejects invalid quantities and prices', () => {
    for (const qty of [-1,4,1.5,NaN]) expect(previewAdjustment(sale,line,qty,10)).toBeNull()
    expect(previewAdjustment(sale,line,1,Infinity)).toBeNull()
  })
})
