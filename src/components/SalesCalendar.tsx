import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { calendarDays, dayLabel, moveMonth, shopDayKey } from '../lib/sales-calendar'

export function SalesCalendar({ selected, counts, onSelect }: { selected: string; counts: Map<string, number>; onSelect: (day: string) => void }) {
  const [month, setMonth] = useState(() => selected.slice(0, 7))
  const today = shopDayKey()
  return <section className="sales-calendar panel" aria-label="Sales calendar">
    <div className="calendar-toolbar">
      <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setMonth(moveMonth(month, -1))}><ChevronLeft size={20} /></button>
      <label className="calendar-month">Month<input aria-label="Calendar month" type="month" value={month} onChange={(e) => { if (calendarDays(e.target.value).length) setMonth(e.target.value) }} /></label>
      <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setMonth(moveMonth(month, 1))}><ChevronRight size={20} /></button>
      <button type="button" className="ghost-btn" onClick={() => { setMonth(today.slice(0, 7)); onSelect(today) }}>Today</button>
    </div>
    <div className="calendar-grid">
      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day) => <span className="calendar-weekday" key={day}>{day}</span>)}
      {calendarDays(month).map((day, i) => day ? <button key={day} type="button" className={`calendar-day ${day === today ? 'is-today' : ''}`} aria-pressed={day === selected} aria-current={day === today ? 'date' : undefined} aria-label={`${dayLabel(day)}, ${counts.get(day) ?? 0} receipts`} onClick={() => onSelect(day)}>
        <span>{Number(day.slice(-2))}</span>
        <small>{counts.get(day) ? `${counts.get(day)}` : '—'}</small>
      </button> : <span key={`blank-${i}`} />)}
    </div>
    <p className="calendar-hint">Choose a date to see its receipts. The small number is the receipt count, including voided sales. Shop time: Ghana.</p>
  </section>
}
