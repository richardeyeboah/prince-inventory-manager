import { expect, it } from 'vitest'
import { salesPeriodBounds } from './sales-period'
it('includes a full month and handles December rollover', () => {
  expect(salesPeriodBounds('month','2026-12','','','')).toEqual({start:'2026-12-01T00:00:00Z',end:'2027-01-01T00:00:00.000Z'})
})
it('includes the entire final custom date in Ghana time', () => {
  expect(salesPeriodBounds('custom','','','2024-02-28','2024-02-29')).toEqual({start:'2024-02-28T00:00:00Z',end:'2024-03-01T00:00:00.000Z'})
  expect(salesPeriodBounds('custom','','','2026-02-29','2026-03-01')).toBeNull()
  expect(salesPeriodBounds('custom','','','2026-03-02','2026-03-01')).toBeNull()
})
it('supports whole year and all dates', () => {
  expect(salesPeriodBounds('year','','2026','','')).toEqual({start:'2026-01-01T00:00:00Z',end:'2027-01-01T00:00:00Z'})
  expect(salesPeriodBounds('all','','','','')).toEqual({start:null,end:null})
})
