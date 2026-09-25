// Receipts are grouped by the shop's day in Ghana, not the viewer's device timezone.
export function shopDayKey(value: string | Date = new Date()): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Accra', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
export function calendarDays(month: string): (string | null)[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return []
  const first = new Date(`${month}-01T12:00:00Z`)
  const offset = (first.getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const days: (string | null)[] = Array(offset).fill(null)
  for (let day = 1; day <= count; day++) days.push(`${month}-${String(day).padStart(2, '0')}`)
  while (days.length % 7) days.push(null)
  return days
}
export function moveMonth(month: string, delta: number) {
  const date = new Date(`${month}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + delta)
  return date.toISOString().slice(0, 7)
}
export function dayLabel(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
