export type SalesPeriod = 'month' | 'year' | 'custom' | 'all'

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

// Shop dates use Ghana time (UTC), regardless of the device timezone.
export function salesPeriodBounds(period: SalesPeriod, month: string, year: string, start: string, end: string) {
  if (period === 'all') return { start: null, end: null }
  if (period === 'month') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null
    start = `${month}-01`
    const date = new Date(start + 'T00:00:00Z')
    date.setUTCMonth(date.getUTCMonth() + 1)
    return { start: start + 'T00:00:00Z', end: date.toISOString() }
  }
  if (period === 'year') {
    if (!/^\d{4}$/.test(year) || Number(year) < 1 || Number(year) > 9998) return null
    return { start: `${year}-01-01T00:00:00Z`, end: `${Number(year) + 1}-01-01T00:00:00Z` }
  }
  if (!validDate(start) || !validDate(end) || start > end) return null
  const next = new Date(end + 'T00:00:00Z')
  next.setUTCDate(next.getUTCDate() + 1)
  return { start: start + 'T00:00:00Z', end: next.toISOString() }
}
