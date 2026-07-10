import {
  challengeDayNumber,
  is75Soft,
  isPerfectLog,
  normalizeChallengeType,
  workout1Done,
  workout2Done,
} from './challenge'

const CHALLENGE_DAYS = 75

export function todayLocalISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysISO(iso, delta) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function minDateStr(a, b) {
  return a <= b ? a : b
}

export function formatJourneyDisplayName(username) {
  if (!username) return 'User'
  const local = String(username).includes('@') ? String(username).split('@')[0] : String(username)
  if (!local) return 'User'
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export function challengeBadgeLabel(challengeType) {
  return is75Soft(challengeType) ? '75 SOFT' : '75 HARD'
}

export function formatJourneyStartDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso + 'T12:00:00'))
}

export function timeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const now = Date.now()
  const sec = Math.max(0, Math.floor((now - then) / 1000))
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = Math.floor(hr / 24)
  if (day < 14) return `${day} day${day === 1 ? '' : 's'} ago`
  return formatJourneyStartDate(String(iso).slice(0, 10))
}

export function hasAnyTaskLogged(log) {
  if (!log) return false
  return !!(
    log.diet_done ||
    workout1Done(log) ||
    workout2Done(log) ||
    log.reading_done ||
    log.photo_done ||
    (log.water_ml ?? 0) > 0 ||
    log.is_recovery_day
  )
}

export function buildLogsByDate(logs) {
  const map = new Map()
  for (const row of logs || []) {
    if (row?.date) map.set(row.date, row)
  }
  return map
}

export function dateForChallengeDay(startDate, dayNum) {
  return addDaysISO(startDate, dayNum - 1)
}

export function getGridDayStatus(dayDate, log, today, challengeType) {
  if (dayDate > today) return { status: 'future', label: 'Upcoming' }
  if (!log) {
    if (!is75Soft(challengeType)) return { status: 'missed', label: 'Missed' }
    return { status: 'empty', label: 'No log' }
  }
  if (isPerfectLog(log, challengeType)) return { status: 'complete', label: 'All tasks complete' }
  if (hasAnyTaskLogged(log)) return { status: 'partial', label: 'Logged — incomplete' }
  if (!is75Soft(challengeType)) return { status: 'missed', label: 'Missed' }
  return { status: 'empty', label: 'No activity' }
}

export function buildChallengeGrid(startDate, logsByDate, challengeType, today = todayLocalISO()) {
  const cells = []
  for (let day = 1; day <= CHALLENGE_DAYS; day += 1) {
    const date = dateForChallengeDay(startDate, day)
    const log = logsByDate.get(date) ?? null
    const { status, label } = getGridDayStatus(date, log, today, challengeType)
    cells.push({ day, date, status, label })
  }
  return cells
}

export function computeJourneyStats(logs, challengeType) {
  const ct = normalizeChallengeType(challengeType)
  let daysWithActivity = 0
  let totalWaterMl = 0
  let workoutsDone = 0
  let readingDays = 0
  let dietDays = 0

  for (const log of logs || []) {
    if (hasAnyTaskLogged(log)) daysWithActivity += 1
    totalWaterMl += Number(log.water_ml) || 0
    if (workout1Done(log)) workoutsDone += 1
    if (log.reading_done) readingDays += 1
    if (log.diet_done) dietDays += 1
  }

  return {
    daysWithActivity,
    totalWaterLiters: (totalWaterMl / 1000).toFixed(1),
    workoutsDone,
    readingDays,
    dietDays,
    perfectDays: (logs || []).filter((l) => isPerfectLog(l, ct)).length,
  }
}

export function buildAttemptTimeline(attempts, today = todayLocalISO()) {
  return (attempts || []).map((att) => {
    const isCurrent = !att.ended_at
    const through = att.ended_at || minDateStr(today, addDaysISO(att.start_date, 74))
    const dayReached =
      att.start_date && through >= att.start_date
        ? challengeDayNumber(att.start_date, through)
        : 0
    return { ...att, isCurrent, dayReached }
  })
}

export function currentChallengeDay(startDate, today = todayLocalISO()) {
  if (!startDate) return 1
  const end = addDaysISO(startDate, 74)
  const through = minDateStr(today, end)
  if (through < startDate) return 1
  return challengeDayNumber(startDate, through)
}

export function journeyPublicUrl(username) {
  const slug = encodeURIComponent(String(username || '').trim())
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://unlock75.app'
  return `${origin}/journey/${slug}`
}

export function journeyShareUrl(username) {
  const slug = encodeURIComponent(String(username || '').trim())
  return `https://unlock75.app/journey/${slug}`
}
