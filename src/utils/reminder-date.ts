function padCalendarPart(value: number): string {
  return String(value).padStart(2, '0')
}

export function calendarDateToReminderTimestamp(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('Tanggal reminder tidak valid.')

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
    throw new Error('Tanggal reminder tidak valid.')
  }

  return localDate.toISOString()
}

export function reminderTimestampToCalendarDate(value: string | null): string {
  if (!value) return ''
  const localDate = new Date(value)
  if (!Number.isFinite(localDate.getTime())) return ''

  return [
    localDate.getFullYear(),
    padCalendarPart(localDate.getMonth() + 1),
    padCalendarPart(localDate.getDate()),
  ].join('-')
}
