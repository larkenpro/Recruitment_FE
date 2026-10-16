import dayjs from 'dayjs'

// How the app shows dates, and the pickers' typed format too.
export const DATE_FORMAT = 'DD/MM/YYYY'
export const DATE_TIME_FORMAT = `${DATE_FORMAT} HH:mm`

export const formatDate = (value) => (value ? dayjs(value).format(DATE_FORMAT) : '—')
export const formatDateTime = (value) => (value ? dayjs(value).format(DATE_TIME_FORMAT) : '—')

// Applications stay open two months from the event's start (today if it has none). A start long
// enough ago that this has passed counts from today instead, so the default is never a past day.
export const defaultLinkExpiry = (startDate, today = dayjs()) => {
  const until = dayjs(startDate ?? today).add(2, 'month')
  return until.isBefore(today, 'day') ? today.add(2, 'month') : until
}
