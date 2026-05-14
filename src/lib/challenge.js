/** @typedef {'75hard' | '75soft'} ChallengeType */

export const CHALLENGE_75_HARD = '75hard'
export const CHALLENGE_75_SOFT = '75soft'

export function normalizeChallengeType(raw) {
  const t = String(raw ?? '').toLowerCase().trim()
  if (t === CHALLENGE_75_SOFT || t === '75_soft' || t === 'soft') return CHALLENGE_75_SOFT
  return CHALLENGE_75_HARD
}

/** Profile must explicitly be 75hard or 75soft to skip challenge selection. */
export function isChallengeTypeExplicitlySet(raw) {
  const t = String(raw ?? '').toLowerCase().trim()
  return t === CHALLENGE_75_HARD || t === CHALLENGE_75_SOFT
}

export function is75Soft(challengeType) {
  return normalizeChallengeType(challengeType) === CHALLENGE_75_SOFT
}

export function waterTargetMl(challengeType) {
  return is75Soft(challengeType) ? 3000 : 3700
}

export function waterLitersLabel(challengeType) {
  return is75Soft(challengeType) ? '3.0' : '3.7'
}

export function challengeTaskCount(challengeType) {
  return is75Soft(challengeType) ? 5 : 6
}

export function workout1Done(log) {
  return !!(log?.workout_1_done ?? log?.indoor_done)
}

export function workout2Done(log) {
  return !!(log?.workout_2_done ?? log?.outdoor_done)
}

export function workout1Type(log) {
  return log?.workout_1_type ?? log?.indoor_workout_type ?? null
}

export function workout2Type(log) {
  return log?.workout_2_type ?? log?.outdoor_workout_type ?? null
}

/** Both workouts logged and both indoor-only (75 Hard rule violation). */
export function workoutRuleViolated(log) {
  const indoorType = String(workout1Type(log) || 'indoor')
  const outdoorType = String(workout2Type(log) || 'outdoor')
  return (
    !!workout1Done(log) &&
    !!workout2Done(log) &&
    indoorType === 'indoor' &&
    outdoorType === 'indoor'
  )
}

export function isWaterDone(log, challengeType) {
  const t = waterTargetMl(challengeType)
  return (log?.water_ml ?? 0) >= t
}

export function isPerfectLog(log, challengeType) {
  if (!log) return false
  const ct = normalizeChallengeType(challengeType)
  if (is75Soft(ct)) {
    return !!(
      log.diet_done &&
      workout1Done(log) &&
      log.reading_done &&
      isWaterDone(log, ct)
    )
  }
  return !!(
    log.diet_done &&
    workout1Done(log) &&
    workout2Done(log) &&
    log.reading_done &&
    log.photo_done &&
    isWaterDone(log, ct) &&
    !workoutRuleViolated(log)
  )
}

export function dayIncompleteHard(log, challengeType) {
  if (!log || is75Soft(challengeType)) return false
  return (
    !log.diet_done ||
    !workout1Done(log) ||
    !workout2Done(log) ||
    !log.reading_done ||
    !log.photo_done ||
    !isWaterDone(log, challengeType) ||
    workoutRuleViolated(log)
  )
}

export function missedRequirementLabels(log, challengeType) {
  if (!log) return ['No daily log recorded']
  const ct = normalizeChallengeType(challengeType)
  const m = []
  const wt = waterTargetMl(ct)
  if (is75Soft(ct)) {
    if (!log.diet_done) m.push('Eat well')
    if (!workout1Done(log)) m.push('Workout (45 min)')
    if (!log.reading_done) m.push('Reading (10 pages)')
    if ((log.water_ml ?? 0) < wt) m.push(`Water (logged ${log.water_ml ?? 0} ml, need ${wt} ml)`)
    return m.length ? m : ['Incomplete day']
  }
  if (!log.diet_done) m.push('Clean diet')
  if (!workout1Done(log)) m.push('Workout 1 (45 min)')
  if (!workout2Done(log)) m.push('Workout 2 (45 min)')
  if (!log.reading_done) m.push('Reading (10 pages)')
  if (!log.photo_done) m.push('Progress photo')
  if ((log.water_ml ?? 0) < wt) m.push(`Water (logged ${log.water_ml ?? 0} ml, need ${wt} ml)`)
  if (workoutRuleViolated(log)) m.push('Outdoor workout rule')
  return m.length ? m : ['Incomplete day']
}

export function taskBreakdownLine(log, challengeType) {
  if (!log) return 'No log'
  const ct = normalizeChallengeType(challengeType)
  const wt = waterTargetMl(ct)
  if (is75Soft(ct)) {
    const parts = [
      log.diet_done ? 'Eat well ✓' : 'Eat well —',
      workout1Done(log) ? 'Workout ✓' : 'Workout —',
      log.reading_done ? 'Read ✓' : 'Read —',
      isWaterDone(log, ct) ? 'Water ✓' : `Water ${log.water_ml ?? 0}/${wt} ml`,
    ]
    return parts.join(' · ')
  }
  const parts = [
    log.diet_done ? 'Clean diet ✓' : 'Clean diet —',
    workout1Done(log) ? 'Workout 1 ✓' : 'Workout 1 —',
    workout2Done(log) ? 'Workout 2 ✓' : 'Workout 2 —',
    log.reading_done ? 'Read ✓' : 'Read —',
    log.photo_done ? 'Photo ✓' : 'Photo —',
    isWaterDone(log, ct) ? 'Water ✓' : `Water ${log.water_ml ?? 0}/${wt} ml`,
  ]
  return parts.join(' · ')
}

export function waterMilestoneMessage(ml, challengeType) {
  const target = waterTargetMl(challengeType)
  const m = Math.max(0, Number(ml) || 0)
  const liters = (target / 1000).toFixed(1)
  if (m <= 0) return 'Log sips as you go — small amounts add up.'
  if (m < 1000) return 'Good start — keep a bottle nearby.'
  if (m < target * 0.45) return 'Almost halfway to today’s target.'
  if (m < target * 0.75) return 'Past halfway — steady wins.'
  if (m < target) return `Close to ${liters}L — finish strong.`
  return 'Daily water target reached.'
}

export function mondayKeyOfWeek(isoDateStr) {
  const d = new Date(isoDateStr + 'T12:00:00')
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/** True if another day in the same ISO week (Mon–Sun) already has is_recovery_day. */
export function recoveryDayUsedElsewhereInWeek(allLogs, viewDateStr, currentLogDate) {
  const wk = mondayKeyOfWeek(viewDateStr)
  for (const log of allLogs || []) {
    if (!log?.date || !log.is_recovery_day) continue
    if (log.date === currentLogDate) continue
    if (mondayKeyOfWeek(log.date) !== wk) continue
    return true
  }
  return false
}

const CHALLENGE_DAY_COUNT = 75

function parseISODateLocalChallenge(iso) {
  const [yy, mm, dd] = String(iso).split('-').map(Number)
  return new Date(yy, mm - 1, dd)
}

/** Calendar day index within the challenge (1–75) for `dateStr` relative to `startDateStr`. */
export function challengeDayNumber(startDateStr, dateStr) {
  const s = parseISODateLocalChallenge(startDateStr)
  const v = parseISODateLocalChallenge(dateStr)
  const diff = Math.round((v - s) / 86400000)
  return Math.min(CHALLENGE_DAY_COUNT, Math.max(1, diff + 1))
}

/** Yesterday was a failing day for 75 Hard (missed requirements or no log when past day-1 grace). */
export function dayFailsHardRules(logOrNull, attemptAgeDays, challengeType) {
  if (is75Soft(challengeType)) return false
  if (logOrNull) return !isPerfectLog(logOrNull, challengeType)
  return attemptAgeDays > 1
}

export function summarizeAttemptThrough(activeAttempt, throughDateStr, logsByDateMap, challengeType) {
  if (!activeAttempt) return null
  const start = activeAttempt.start_date
  const CHALLENGE_DAYS = 75
  const addDaysISO = (iso, delta) => {
    const x = new Date(iso + 'T12:00:00')
    x.setDate(x.getDate() + delta)
    const y = x.getFullYear()
    const mo = String(x.getMonth() + 1).padStart(2, '0')
    const da = String(x.getDate()).padStart(2, '0')
    return `${y}-${mo}-${da}`
  }
  const minDateStr = (a, b) => (a <= b ? a : b)
  const parseISODateLocal = (iso) => {
    const [yy, mm, dd] = iso.split('-').map(Number)
    return new Date(yy, mm - 1, dd)
  }
  const formatLocalDate = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const through = minDateStr(throughDateStr, addDaysISO(start, 74))
  let perfect = 0
  for (let i = 0; i < CHALLENGE_DAYS; i += 1) {
    const d = parseISODateLocal(start)
    d.setDate(d.getDate() + i)
    const key = formatLocalDate(d)
    if (key > through) break
    const log = logsByDateMap.get(key)
    if (log && isPerfectLog(log, challengeType)) perfect += 1
  }
  return {
    dayReached: challengeDayNumber(start, through),
    perfectDays: perfect,
  }
}
