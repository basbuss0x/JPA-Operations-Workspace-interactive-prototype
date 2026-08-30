import { describe, expect, it } from 'vitest'
import {
  calendarDateToReminderTimestamp,
  futureCalendarDate,
  reminderTimestampToCalendarDate,
  validateReminderCalendarDate,
  validateReminderTimestamp,
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

  it('rejects empty, malformed, impossible, and past calendar dates', () => {
    const now = new Date('2026-02-21T08:00:00.000Z')

    expect(validateReminderCalendarDate('', now)).toBe('Tanggal tindak lanjut wajib diisi.')
    expect(validateReminderCalendarDate('21-02-2026', now)).toBe('Tanggal tindak lanjut tidak valid.')
    expect(validateReminderCalendarDate('2026-02-30', now)).toBe('Tanggal tindak lanjut tidak valid.')
    expect(validateReminderTimestamp('2026-02-30T00:00:00.000Z', now)).toBe('Tanggal tindak lanjut tidak valid.')
    expect(validateReminderCalendarDate('2026-02-20', now)).toBe('Tanggal tindak lanjut tidak boleh sebelum hari ini.')
    expect(validateReminderCalendarDate('2026-02-21', now)).toBeNull()
  })

  it('suggests a future local calendar date without UTC drift', () => {
    const now = new Date('2026-02-21T08:00:00.000Z')
    const suggested = futureCalendarDate(3, now)

    expect(suggested).toBe('2026-02-24')
    expect(reminderTimestampToCalendarDate(calendarDateToReminderTimestamp(suggested))).toBe(suggested)
  })
})
