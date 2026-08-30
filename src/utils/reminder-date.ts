const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function padCalendarPart(value: number): string {
  return String(value).padStart(2, '0')
}

function formatCalendarDate(value: Date): string {
  return [
    value.getFullYear(),
    padCalendarPart(value.getMonth() + 1),
    padCalendarPart(value.getDate()),
  ].join('-')
}

function parseCalendarDate(value: string): Date | null {
  const match = CALENDAR_DATE_PATTERN.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const localDate = new Date(0)
  localDate.setFullYear(year, month - 1, day)
  localDate.setHours(0, 0, 0, 0)

  if (
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== month - 1 ||
    localDate.getDate() !== day
  ) {
    return null
  }

  return localDate
}

export function getLocalCalendarDate(value: Date = new Date()): string {
  return Number.isFinite(value.getTime()) ? formatCalendarDate(value) : ''
}

export function futureCalendarDate(days: number, now: Date = new Date()): string {
  const localDate = new Date(now)
  localDate.setHours(12, 0, 0, 0)
  localDate.setDate(localDate.getDate() + days)
  return getLocalCalendarDate(localDate)
}

export function validateReminderCalendarDate(
  value: string,
  now: Date = new Date(),
  label = 'Tanggal tindak lanjut',
): string | null {
  if (!value) return `${label} wajib diisi.`
  const localDate = parseCalendarDate(value)
  if (!localDate) return `${label} tidak valid.`

  const today = new Date(now)
  if (Number.isFinite(today.getTime())) {
    today.setHours(0, 0, 0, 0)
    if (localDate.getTime() < today.getTime()) {
      return `${label} tidak boleh sebelum hari ini.`
    }
  }

  return null
}

export function validateReminderTimestamp(
  value: string,
  now: Date = new Date(),
  label = 'Tanggal tindak lanjut',
): string | null {
  if (!value) return `${label} wajib diisi.`
  const timestamp = new Date(value)
  if (!Number.isFinite(timestamp.getTime())) return `${label} tidak valid.`
  const calendarPart = /^(\d{4}-\d{2}-\d{2})(?:T|$)/.exec(value)?.[1]
  if (!calendarPart || !parseCalendarDate(calendarPart)) return `${label} tidak valid.`
  return validateReminderCalendarDate(
    reminderTimestampToCalendarDate(value),
    now,
    label,
  )
}

export function calendarDateToReminderTimestamp(value: string): string {
  const localDate = parseCalendarDate(value)
  if (!localDate) throw new Error('Tanggal pengingat tidak valid.')
  return localDate.toISOString()
}

export function reminderTimestampToCalendarDate(value: string | null): string {
  if (!value) return ''
  const localDate = new Date(value)
  if (!Number.isFinite(localDate.getTime())) return ''

  return formatCalendarDate(localDate)
}
