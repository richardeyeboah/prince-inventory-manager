import { expect, it } from 'vitest'
import { calendarDays, moveMonth, shopDayKey } from './sales-calendar'
it('groups by Ghana midnight regardless of timestamp offset', () => {
  expect(shopDayKey('2026-09-24T23:30:00-05:00')).toBe('2026-09-25')
  expect(shopDayKey('2026-09-25T00:30:00+02:00')).toBe('2026-09-24')
})
it('lays out leap years and months beginning on Sunday', () => {
  expect(calendarDays('2024-02').filter(Boolean)).toHaveLength(29)
  expect(calendarDays('2026-02').filter(Boolean)).toHaveLength(28)
  expect(calendarDays('2026-02').slice(0, 6)).toEqual(Array(6).fill(null))
  expect(calendarDays('2026-13')).toEqual([])
})
it('navigates across year boundaries', () => {
  expect(moveMonth('2026-12', 1)).toBe('2027-01')
  expect(moveMonth('2026-01', -1)).toBe('2025-12')
})
