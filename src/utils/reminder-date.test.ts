import { describe, expect, it } from 'vitest'
import {
  calendarDateToReminderTimestamp,
  reminderTimestampToCalendarDate,
} from './reminder-date'

describe('local operator reminder dates', () => {
  it('stores a selected calendar date at local midnight and restores the same date', () => {
    const timestamp = calendarDateToReminderTimestamp('2026-02-21')
    const localDate = new Date(timestamp)

    expect(localDate.getFullYear()).toBe(2026)
    expect(localDate.getMonth()).toBe(1)
    expect(localDate.getDate()).toBe(21)
    expect(localDate.getHours()).toBe(0)
    expect(localDate.getMinutes()).toBe(0)
    expect(reminderTimestampToCalendarDate(timestamp)).toBe('2026-02-21')
  })
})
