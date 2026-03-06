export function isNyMarketOpen(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  const parts = formatter.formatToParts(now)
  const read = (type) => parts.find((part) => part.type === type)?.value

  const weekday = read('weekday')
  const hour = Number(read('hour'))
  const minute = Number(read('minute'))

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false

  const weekdayMap = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7
  }

  const day = weekdayMap[weekday]
  if (!day || day >= 6) return false

  const totalMinutes = (hour * 60) + minute
  const marketOpenMinutes = (9 * 60) + 30
  const marketCloseMinutes = 16 * 60

  return totalMinutes >= marketOpenMinutes && totalMinutes <= marketCloseMinutes
}
