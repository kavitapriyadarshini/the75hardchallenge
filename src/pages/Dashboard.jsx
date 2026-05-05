import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  WORKOUT_DB,
  MACRO_CALC,
  FOOD_DB,
  MEAL_SLOT_ORDER,
  composeMealPlanFromAlternatives,
  mealTiersForDiet,
} from '../lib/constants'
import {
  CHALLENGE_75_HARD,
  CHALLENGE_75_SOFT,
  normalizeChallengeType,
  isChallengeTypeExplicitlySet,
  is75Soft,
  waterTargetMl,
  waterLitersLabel,
  challengeTaskCount,
  workout1Done,
  workout2Done,
  workout1Type,
  workout2Type,
  workoutRuleViolated,
  isWaterDone,
  isPerfectLog,
  missedRequirementLabels,
  taskBreakdownLine,
  waterMilestoneMessage,
  summarizeAttemptThrough,
  dayFailsHardRules,
  recoveryDayUsedElsewhereInWeek,
} from '../lib/challenge'
import './dashboard.css'

const CHALLENGE_DAYS = 75
const EMPTY_MACROS_FALLBACK = Object.freeze({})

const MEALS_MICRONUTRIENTS = [
  {
    dot: '#d65a5a',
    name: 'Iron',
    target: '18mg',
    sources: 'ragi, palak, rajma',
  },
  {
    dot: '#5a9bd6',
    name: 'Calcium',
    target: '1000mg',
    sources: 'curd, ragi, sesame',
  },
  {
    dot: '#7bc96f',
    name: 'Vitamin C',
    target: '75mg',
    sources: 'guava, amla, lemon',
  },
  {
    dot: '#c9a227',
    name: 'Magnesium',
    target: '310mg',
    sources: 'pumpkin seeds, almonds, spinach',
  },
  {
    dot: '#9b7ed9',
    name: 'B12',
    target: '2.4mcg',
    sources: 'eggs, paneer, curd',
  },
  {
    dot: '#e07b39',
    name: 'Vitamin D',
    target: '600IU',
    sources: 'morning sunlight + eggs',
  },
]

const MEAL_SLOT_LABELS = ['Pre-workout', 'Breakfast', 'Lunch', 'Snack', 'Dinner']

const MEAL_LINE_START_RES = [/^🌅/, /^🍳/, /^🍱/, /^🍎/, /^🌙/]

const MEAL_HEADER_PREFIX = [
  '🌅 Pre-workout (6:30 AM):',
  '🍳 Breakfast (8:30 AM):',
  '🍱 Lunch (1:00 PM):',
  '🍎 Snack (4:30 PM):',
  '🌙 Dinner (7:30 PM):',
]

const WORKOUT_PREF_CHIPS = [
  'All',
  'Full Body',
  'Upper Body',
  'Lower Body',
  'Core',
  'Cardio',
  'Flexibility',
  'Recovery',
]

function normalizeIngredientPhrase(raw) {
  let s = (raw ?? '').trim()
  s = s.replace(/\b(today|tomorrow|this week|right now|please|extra|some|little)\b/gi, '').trim()
  const parts = s.split(/\s+/).filter(Boolean).slice(0, 4)
  return parts.join(' ') || raw?.trim() || ''
}

function parseSpecialRequest(text) {
  const src = (text ?? '').trim()
  const mustInclude = []
  const mustExclude = []
  if (!src) {
    return { mustInclude, mustExclude, weather: 'normal', raw: '' }
  }
  const includeRe = /\b(?:include|have|got)\s+([^,.;!\n]+)/gi
  let m
  while ((m = includeRe.exec(src)) !== null) {
    const n = normalizeIngredientPhrase(m[1])
    if (n.length > 1) mustInclude.push(n)
  }
  const excludeRe = /\b(?:no|avoid|allergic to|bored of)\s+([^,.;!\n]+)/gi
  while ((m = excludeRe.exec(src)) !== null) {
    const n = normalizeIngredientPhrase(m[1])
    if (n.length > 1) mustExclude.push(n)
  }
  const dedupe = (arr) =>
    [...new Map(arr.map((x) => [String(x).toLowerCase(), x])).values()]
  let weather = 'normal'
  if (/\b(?:very\s+)?hot\b|hot\s+day|it['']?s\s+hot\b/i.test(src)) {
    weather = 'hot'
  } else if (/\b(?:very\s+)?cold\b|cold\s+day|it['']?s\s+cold\b/i.test(src)) {
    weather = 'cold'
  }
  return {
    mustInclude: dedupe(mustInclude),
    mustExclude: dedupe(mustExclude),
    weather,
    raw: src,
  }
}

function buildParsedPromptFragment(parsed) {
  const inc = parsed.mustInclude.length ? parsed.mustInclude.join('; ') : 'none'
  const exc = parsed.mustExclude.length ? parsed.mustExclude.join('; ') : 'none'
  let weatherLine = 'normal'
  if (parsed.weather === 'hot') {
    weatherLine =
      'hot — suggest cooling foods like buttermilk, cucumber, sabja, coconut water'
  } else if (parsed.weather === 'cold') {
    weatherLine =
      'cold — suggest warming foods like ginger, sesame, til, soups'
  }
  return `MUST INCLUDE: ${inc}. MUST EXCLUDE: ${exc}. WEATHER: ${weatherLine} — if hot, favour cooling foods; if cold, favour warming foods.`
}

function formatParsedNotesForFallback(parsed) {
  const parts = []
  if (parsed.mustInclude.length) {
    parts.push(`Include where possible: ${parsed.mustInclude.join(', ')}`)
  }
  if (parsed.mustExclude.length) {
    parts.push(`Avoid: ${parsed.mustExclude.join(', ')}`)
  }
  if (parsed.weather === 'hot') parts.push('Weather: hot — favour cooling options.')
  if (parsed.weather === 'cold') parts.push('Weather: cold — favour warming options.')
  return parts.join(' · ')
}

function buildMealPlanPrompt(profile, specialRequestText) {
  const macros = profile?.macros ?? {}
  const restrictions = Array.isArray(profile?.restrictions)
    ? profile.restrictions.join(', ') || 'none'
    : 'none'
  const gender = profile?.gender ?? 'person'
  const weight = profile?.weight_kg != null ? `${profile.weight_kg}` : 'not specified'
  const diet = profile?.diet_type ?? 'General Healthy'
  const req = (specialRequestText ?? '').trim() || 'none'
  const parsed = parseSpecialRequest(specialRequestText)
  const parsedBlock = buildParsedPromptFragment(parsed)
  return `You are a nutrition coach. Create a detailed single-day meal plan for a ${gender}, ${weight}kg, for the 75 Hard challenge. Daily targets: ${macros.calories ?? '—'}kcal, ${macros.protein ?? '—'}g protein, ${macros.carbs ?? '—'}g carbs, ${macros.fat ?? '—'}g fat, ${macros.fiber ?? '—'}g fiber. Diet: ${diet}. Restrictions: ${restrictions}. Special request (verbatim): ${req}. ${parsedBlock} Format: exactly 5 meals, one line each, with emoji headers — Pre-workout 6:30am, Breakfast 8:30am, Lunch 1pm, Snack 4:30pm, Dinner 7:30pm. For each meal show items with quantities. At the END of each meal line append exactly one token in this format (no extra text after it): [P:18g C:45g F:8g ~320kcal] using your best estimates for that meal only. Keep it practical.`
}

function hardcodedMealPlanBody(dietType, slotIndices) {
  return composeMealPlanFromAlternatives(dietType, slotIndices ?? null)
}

function fallbackMealPlanText(profile, specialRequestText, slotIndices) {
  const trimmed = (specialRequestText ?? '').trim()
  const prefix = trimmed ? `Customised for: ${trimmed}\n\n` : ''
  const parsed = parseSpecialRequest(specialRequestText)
  const note = formatParsedNotesForFallback(parsed)
  const body = hardcodedMealPlanBody(profile?.diet_type, slotIndices ?? null)
  const mid = note ? `${note}\n\n` : ''
  return prefix + mid + body
}

const MACRO_TAIL_RE = /\s*\[P:([\d.]+)g\s*C:([\d.]+)g\s*F:([\d.]+)g\s*~(\d+)kcal\]\s*$/i

function stripMacroSuffix(line) {
  const m = line.match(MACRO_TAIL_RE)
  if (!m) return { body: line, macros: null }
  return {
    body: line.replace(MACRO_TAIL_RE, '').trim(),
    macros: { p: m[1], c: m[2], f: m[3], kcal: m[4] },
  }
}

function splitMealPlan(fullText) {
  const lines = (fullText ?? '').split(/\r?\n/)
  const preamble = []
  const segments = MEAL_SLOT_ORDER.map(() => ({ lines: [] }))
  let slot = -1
  for (const line of lines) {
    const t = line.trim()
    const idx = MEAL_LINE_START_RES.findIndex((re) => re.test(t))
    if (idx >= 0) {
      slot = idx
      segments[slot].lines.push(line)
    } else if (slot >= 0) {
      segments[slot].lines.push(line)
    } else {
      preamble.push(line)
    }
  }
  return { preamble, segments }
}

function joinMealPlan({ preamble, segments }) {
  const body = segments.flatMap((s) => s.lines)
  return [...preamble, ...body].join('\n')
}

function replaceSegmentInPlan(fullText, slotIndex, newMealLine) {
  const { preamble, segments } = splitMealPlan(fullText)
  if (slotIndex < 0 || slotIndex >= segments.length) return fullText
  segments[slotIndex] = { lines: [newMealLine] }
  return joinMealPlan({ preamble, segments })
}

function segmentJoinedText(seg) {
  return (seg.lines ?? []).join('\n').trim()
}

function formatTimeHM(isoTs) {
  if (!isoTs) return ''
  const d = new Date(isoTs)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

function slotIndexFromMealSlotKey(slotKey) {
  return MEAL_SLOT_ORDER.indexOf(slotKey)
}

function buildSingleMealPrompt(profile, slotIndex, parsed, macros) {
  const m = macros ?? {}
  const share = {
    protein: Math.max(5, Math.round((m.protein ?? 120) / 5)),
    carbs: Math.max(8, Math.round((m.carbs ?? 200) / 5)),
    fat: Math.max(4, Math.round((m.fat ?? 60) / 5)),
    kcal: Math.max(120, Math.round((m.calories ?? 2000) / 5)),
  }
  const mealName = MEAL_SLOT_LABELS[slotIndex]
  const gender = profile?.gender ?? 'person'
  const weight = profile?.weight_kg != null ? `${profile.weight_kg}` : 'not specified'
  const diet = profile?.diet_type ?? 'General Healthy'
  const restrictions = Array.isArray(profile?.restrictions)
    ? profile.restrictions.join(', ') || 'none'
    : 'none'
  const inc = parsed.mustInclude.length ? parsed.mustInclude.join('; ') : 'none'
  const exc = parsed.mustExclude.length ? parsed.mustExclude.join('; ') : 'none'
  const weather =
    parsed.weather === 'hot' ? 'hot' : parsed.weather === 'cold' ? 'cold' : 'normal'
  return `Suggest an alternative ${mealName} for a ${gender}, ${weight}kg person on 75 Hard challenge. Must match these macros: approx ${share.protein}g protein, ${share.carbs}g carbs, ${share.fat}g fat, ~${share.kcal} kcal for this meal only. Diet: ${diet}. Restrictions: ${restrictions}. MUST EXCLUDE: ${exc}. MUST INCLUDE if possible: ${inc}. Weather context: ${weather} (if hot prefer cooling foods; if cold prefer warming foods). Return only the meal items with quantities, no explanation. Use the same emoji header format as the slot (${MEAL_HEADER_PREFIX[slotIndex]} …). End the line with macro estimates exactly like: [P:18g C:45g F:8g ~320kcal]`
}

function cleanSingleMealResponse(raw, slotIndex) {
  const lines = (raw ?? '')
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  let line = lines.find((l) => /\[P:/i.test(l)) || lines[0] || ''
  const need = ['🌅', '🍳', '🍱', '🍎', '🌙'][slotIndex]
  if (line && !line.trimStart().startsWith(need)) {
    line = `${MEAL_HEADER_PREFIX[slotIndex]} ${line.replace(/^(🌅|🍳|🍱|🍎|🌙)[^\s]*\s*/u, '').trim()}`
  }
  return line.trim()
}

function computeMealPlanBadges(parsed, segments) {
  const rows = []
  const bodies = segments.map((s) => segmentJoinedText(s).toLowerCase())
  const full = bodies.join(' ')

  const singleBlob = bodies.length === 1
  for (const ing of parsed.mustInclude) {
    const t = ing.toLowerCase()
    let found = -1
    bodies.forEach((b, i) => {
      if (t.length >= 2 && b.includes(t)) found = i
    })
    if (found >= 0) {
      const where = singleBlob ? 'your plan' : MEAL_SLOT_LABELS[found]
      rows.push({
        kind: 'include',
        text: `✓ ${ing} included in ${where} as per your request`,
      })
    } else {
      rows.push({
        kind: 'include',
        muted: true,
        text: `✓ ${ing} — plan aims to reflect your request`,
      })
    }
  }

  for (const ing of parsed.mustExclude) {
    const t = ing.toLowerCase()
    const hit = t.length >= 2 && bodies.some((b) => b.includes(t))
    rows.push({
      kind: 'exclude',
      text: hit
        ? `✗ ${ing} may still appear — please review`
        : `✗ ${ing} excluded from all meals`,
    })
  }

  if (parsed.weather === 'hot') {
    const cool = ['buttermilk', 'cucumber', 'sabja', 'coconut', 'chaas', 'curd', 'yogurt', 'melon', 'watermelon']
    const hits = cool.filter((k) => full.includes(k))
    rows.push({
      kind: 'weather',
      text: hits.length
        ? `🌡 Cooling foods included — ${hits.join(', ')}`
        : '🌡 Cooling foods included — lighter portions & hydration',
    })
  } else if (parsed.weather === 'cold') {
    const warm = ['ginger', 'sesame', 'til', 'soup', 'warm', 'khichdi', 'tea', 'masala']
    const hits = warm.filter((k) => full.includes(k))
    rows.push({
      kind: 'weather',
      text: hits.length
        ? `🧣 Warming foods included — ${hits.slice(0, 5).join(', ')}`
        : '🧣 Warming foods included',
    })
  }

  return rows
}

function todayLocalISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseISODateLocal(iso) {
  const [y, mo, da] = iso.split('-').map(Number)
  return new Date(y, mo - 1, da)
}

function formatLocalDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function challengeDayNumber(startDateStr, todayStr) {
  const start = parseISODateLocal(startDateStr)
  const today = parseISODateLocal(todayStr)
  const diff = Math.round((today - start) / 86400000)
  return Math.min(CHALLENGE_DAYS, Math.max(1, diff + 1))
}

function typeBadgeClass(type) {
  if (type === 'cardio') return 'dash-type-badge dash-type-cardio'
  if (type === 'strength') return 'dash-type-badge dash-type-strength'
  return 'dash-type-badge dash-type-flex'
}

async function imageFileToJpegDataUrl(file, maxDim = 1280, quality = 0.82) {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('Could not read image'))
      img.src = url
    })
    let { width, height } = img
    const scale = Math.min(1, maxDim / Math.max(width, height, 1))
    width = Math.round(width * scale)
    height = Math.round(height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No canvas')
    ctx.drawImage(img, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function addDaysISO(iso, delta) {
  const d = parseISODateLocal(iso)
  d.setDate(d.getDate() + delta)
  return formatLocalDate(d)
}

function minDateStr(a, b) {
  return a <= b ? a : b
}

function emptyDayLog(date) {
  return {
    id: null,
    date,
    water_ml: 0,
    diet_done: false,
    indoor_done: false,
    outdoor_done: false,
    reading_done: false,
    photo_done: false,
    indoor_workout: null,
    outdoor_workout: null,
    indoor_workout_type: null,
    outdoor_workout_type: null,
    notes: null,
    meal_plan: null,
    actual_meals: [],
    actual_macros_total: null,
    progress_photo: null,
    reading_log: null,
    workout_voice: null,
    is_recovery_day: false,
  }
}

function attemptAgeDays(startDateStr, refDateStr) {
  const a = parseISODateLocal(startDateStr)
  const b = parseISODateLocal(refDateStr)
  return Math.round((b - a) / 86400000)
}

function formatLongDate(iso) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parseISODateLocal(iso))
}

async function fetchMealPlanFromAnthropic(prompt) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_KEY
  if (!apiKey) {
    throw new Error('Missing VITE_ANTHROPIC_KEY in environment.')
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(errBody || `API error ${res.status}`)
  }
  const data = await res.json()
  const block = data.content?.find((b) => b.type === 'text')
  return (block?.text ?? '').trim()
}

const DIRTY_MEAL_KEYWORDS = [
  'fried',
  'maida',
  'sugar',
  'cake',
  'pizza',
  'burger',
  'chips',
  'chocolate',
  'alcohol',
  'beer',
  'wine',
  'samosa',
  'pakoda',
  'mithai',
  'sweet',
  'dessert',
  'ice cream',
  'ice-cream',
  'candy',
  'soda',
  'cola',
]

function createInitialMealElseSlots() {
  return MEAL_SLOT_ORDER.map(() => ({
    expanded: false,
    draft: '',
    mode: 'custom',
    loading: false,
    breakdownLoading: false,
    logging: false,
    result: null,
    breakdown: null,
    modifiedFromSuggestion: false,
  }))
}

function sumActualMacrosFromMeals(meals) {
  const base = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  if (!Array.isArray(meals)) return base
  for (const m of meals) {
    if (!m) continue
    base.calories += Number(m.calories) || 0
    base.protein_g += Number(m.protein_g) || 0
    base.carbs_g += Number(m.carbs_g) || 0
    base.fat_g += Number(m.fat_g) || 0
    base.fiber_g += Number(m.fiber_g) || 0
  }
  return base
}

function normalizeMealAnalysis(obj) {
  if (!obj || typeof obj !== 'object') return null
  return {
    calories: Math.max(0, Number(obj.calories) || 0),
    protein_g: Math.max(0, Number(obj.protein_g) || 0),
    carbs_g: Math.max(0, Number(obj.carbs_g) || 0),
    fat_g: Math.max(0, Number(obj.fat_g) || 0),
    fiber_g: Math.max(0, Number(obj.fiber_g) || 0),
    is_clean_diet: !!obj.is_clean_diet,
    reason: String(obj.reason ?? '').trim() || 'No explanation provided.',
    violation:
      obj.violation == null || obj.violation === ''
        ? null
        : String(obj.violation).trim(),
  }
}

function parseMealAnalysisJson(raw) {
  let t = (raw ?? '').trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im
  const m = t.match(fence)
  if (m) t = m[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  t = t.slice(start, end + 1)
  try {
    return normalizeMealAnalysis(JSON.parse(t))
  } catch {
    return null
  }
}

function normalizeMealBreakdownArray(arr) {
  if (!Array.isArray(arr)) return null
  const rows = arr
    .map((item) => ({
      item: String(item?.item ?? '').trim(),
      qty: String(item?.qty ?? '-').trim() || '-',
      calories: Math.max(0, Number(item?.calories) || 0),
      protein_g: Math.max(0, Number(item?.protein_g) || 0),
      carbs_g: Math.max(0, Number(item?.carbs_g) || 0),
      fat_g: Math.max(0, Number(item?.fat_g) || 0),
      fiber_g: Math.max(0, Number(item?.fiber_g) || 0),
    }))
    .filter((r) => r.item.length > 0)
  return rows.length ? rows : null
}

function parseMealBreakdownJson(raw) {
  let t = (raw ?? '').trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im
  const m = t.match(fence)
  if (m) t = m[1].trim()
  const start = t.indexOf('[')
  const end = t.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return normalizeMealBreakdownArray(JSON.parse(t.slice(start, end + 1)))
  } catch {
    return null
  }
}

function totalsFromBreakdown(rows) {
  if (!Array.isArray(rows)) return null
  return rows.reduce(
    (acc, r) => ({
      calories: acc.calories + (Number(r.calories) || 0),
      protein_g: acc.protein_g + (Number(r.protein_g) || 0),
      carbs_g: acc.carbs_g + (Number(r.carbs_g) || 0),
      fat_g: acc.fat_g + (Number(r.fat_g) || 0),
      fiber_g: acc.fiber_g + (Number(r.fiber_g) || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  )
}

function inferQuantityMultiplier(tokenLower) {
  const numMatch = tokenLower.match(/(\d+(?:\.\d+)?)/)
  if (!numMatch) return 1
  const v = Number(numMatch[1])
  if (!Number.isFinite(v) || v <= 0) return 1
  if (v > 20) return 1
  return v
}

function normalizeForMatch(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanParsedItemName(raw) {
  const t = normalizeForMatch(raw)
  if (!t) return ''
  const words = t.split(' ')
  if (words.length % 2 === 0) {
    const half = words.length / 2
    const a = words.slice(0, half).join(' ')
    const b = words.slice(half).join(' ')
    if (a === b) return a
  }
  return t
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Match FOOD_DB aliases on word boundaries so substrings like "dal" inside "almonds" never match. */
function resolveFoodDbKey(itemName) {
  const norm = normalizeForMatch(itemName)
  if (!norm) return null
  const hits = []
  for (const [key, row] of Object.entries(FOOD_DB)) {
    const aliases = [key, ...(row.aliases ?? [])].map((a) => normalizeForMatch(a)).filter(Boolean)
    for (const a of aliases) {
      const pattern = a.includes(' ')
        ? new RegExp(`(?:^|\\s)${escapeRegex(a)}(?:$|\\s)`)
        : new RegExp(`\\b${escapeRegex(a)}\\b`)
      if (pattern.test(norm)) hits.push({ key, len: a.length })
    }
  }
  if (!hits.length) return null
  hits.sort((x, y) => y.len - x.len || x.key.localeCompare(y.key))
  return hits[0].key
}

function foodDbDisplayName(key) {
  if (!key) return ''
  const k = String(key)
  return k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ')
}

function stripDuplicateConsecutiveWords(str) {
  let t = String(str ?? '').trim()
  for (let i = 0; i < 12; i += 1) {
    const next = t.replace(/\b(\w+)\s+\1\b/gi, '$1')
    if (next === t) break
    t = next
  }
  return t
}

/** Meal item label for UI: fix duplicated halves (e.g. "banana banana") without forcing lowercase. */
function displayMealItemName(raw) {
  let t = String(raw ?? '').trim()
  if (!t) return ''
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length % 2 === 0) {
    const half = words.length / 2
    const a = words.slice(0, half).join(' ')
    const b = words.slice(half).join(' ')
    if (a.toLowerCase() === b.toLowerCase()) return stripDuplicateConsecutiveWords(a)
  }
  return stripDuplicateConsecutiveWords(t)
}

function loggedMealListLinesFromEntry(loggedEntry) {
  if (!loggedEntry) return []
  if (Array.isArray(loggedEntry.items_breakdown) && loggedEntry.items_breakdown.length) {
    const lines = loggedEntry.items_breakdown
      .map((x) => {
        const item = displayMealItemName(x.item)
        if (!item) return ''
        const rawQty = String(x.qty ?? '').trim()
        const qtyNorm = normalizeForMatch(rawQty)
        const itemNorm = normalizeForMatch(item)
        const qtyRedundant =
          rawQty &&
          (qtyNorm === itemNorm ||
            itemNorm.includes(qtyNorm) ||
            qtyNorm.includes(itemNorm))
        const line = !rawQty || qtyRedundant ? item : `${rawQty} ${item}`.trim()
        return stripDuplicateConsecutiveWords(line)
      })
      .map((s) => s.trim())
      .filter(Boolean)
    const deduped = []
    for (const line of lines) {
      if (deduped.length && deduped[deduped.length - 1].toLowerCase() === line.toLowerCase()) continue
      deduped.push(line)
    }
    return deduped
  }
  const desc = String(loggedEntry.description ?? '').trim()
  if (!desc) return []
  return desc
    .split(/,|\n|\+/)
    .map((x) => displayMealItemName(String(x).trim()))
    .filter(Boolean)
}

function sanitizeMealBreakdownForStorage(rows) {
  if (!Array.isArray(rows) || !rows.length) return null
  return rows.map((r) => {
    const raw = cleanParsedItemName(r.item || '')
    const combined = `${raw} ${String(r.qty ?? '').trim()}`.trim()
    const key = resolveFoodDbKey(combined) || resolveFoodDbKey(raw)
    const itemLabel = key ? foodDbDisplayName(key) : stripDuplicateConsecutiveWords(raw || String(r.item ?? '').trim())
    return {
      ...r,
      item: itemLabel,
    }
  })
}

function deterministicBreakdownFromItems(items, fallbackText) {
  const sourceItems = Array.isArray(items) && items.length
    ? items
    : String(fallbackText ?? '')
        .split(/,|\+|\band\b|\bwith\b/gi)
        .map((s) => ({ item: s.trim(), qty: s.trim() }))
        .filter((x) => x.item)
  const rows = sourceItems.map((x) => {
    const rawItem = cleanParsedItemName(x.item || x.qty || '')
    const qty = String(x.qty ?? x.item ?? '').trim() || '-'
    const key = resolveFoodDbKey(rawItem || qty)
    const mult = inferQuantityMultiplier(normalizeForMatch(qty))
    if (key) {
      const f = FOOD_DB[key]
      return {
        item: foodDbDisplayName(key),
        qty,
        calories: Math.round((f.calories ?? 0) * mult * 10) / 10,
        protein_g: Math.round((f.protein_g ?? 0) * mult * 10) / 10,
        carbs_g: Math.round((f.carbs_g ?? 0) * mult * 10) / 10,
        fat_g: Math.round((f.fat_g ?? 0) * mult * 10) / 10,
        fiber_g: Math.round((f.fiber_g ?? 0) * mult * 10) / 10,
        source: 'from database',
      }
    }
    return {
      item: stripDuplicateConsecutiveWords(rawItem || qty),
      qty,
      calories: 120,
      protein_g: 4,
      carbs_g: 18,
      fat_g: 4,
      fiber_g: 2,
      source: 'estimated',
    }
  })
  return rows.length ? rows : null
}

function fallbackBreakdownFromFoodDb(inputText) {
  return deterministicBreakdownFromItems(null, inputText)
}

function keywordMealFallbackAnalysis(text) {
  const lower = (text ?? '').toLowerCase()
  for (const w of DIRTY_MEAL_KEYWORDS) {
    if (lower.includes(w)) {
      return {
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
        is_clean_diet: false,
        reason: `Contains “${w}”, which is not compatible with a strict clean-eating day on 75 Hard.`,
        violation: w,
      }
    }
  }
  const wc = lower.split(/\s+/).filter(Boolean).length
  const est = Math.min(900, 280 + wc * 35)
  return {
    calories: est,
    protein_g: Math.round(est * 0.25 / 4),
    carbs_g: Math.round(est * 0.45 / 4),
    fat_g: Math.round(est * 0.28 / 9),
    fiber_g: Math.round(est / 1000 * 14),
    is_clean_diet: true,
    reason:
      'No flagged treat foods detected from keywords; macros are rough estimates — adjust if needed.',
    violation: null,
  }
}

async function fetchMealBreakdownFromAnthropic(mealDescription) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_KEY
  if (!apiKey) throw new Error('Missing VITE_ANTHROPIC_KEY in environment.')
  const safe = JSON.stringify(mealDescription ?? '')
  const prompt = `Break down this meal into individual food items with nutrition per serving. Meal: ${safe}. Return ONLY a JSON array: [{ item: string, qty: string, calories: number, protein_g: number, carbs_g: number, fat_g: number, fiber_g: number }]. Be specific with quantities. Indian food knowledge required.`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(errBody || `API error ${res.status}`)
  }
  const data = await res.json()
  const block = data.content?.find((b) => b.type === 'text')
  return (block?.text ?? '').trim()
}

async function fetchMealAnalysisFromAnthropic(mealDescription) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_KEY
  if (!apiKey) {
    throw new Error('Missing VITE_ANTHROPIC_KEY in environment.')
  }
  const safe = JSON.stringify(mealDescription ?? '')
  const prompt = `Analyze this meal for a 75 Hard clean diet challenge: ${safe}. Return ONLY a JSON object with these exact keys: { "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number, "is_clean_diet": boolean, "reason": string, "violation": string or null }. is_clean_diet is false if the meal contains: fried foods, refined flour (maida), sugar, alcohol, processed/packaged snacks, fast food, desserts, or anything that violates a strict clean eating diet. reason is 1 sentence explaining the assessment. violation is the specific item that caused failure, or null if clean.`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(errBody || `API error ${res.status}`)
  }
  const data = await res.json()
  const block = data.content?.find((b) => b.type === 'text')
  return (block?.text ?? '').trim()
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState('today')
  const [todayStr, setTodayStr] = useState(todayLocalISO)
  const [profile, setProfile] = useState(null)
  const [todayLog, setTodayLog] = useState(null)
  const [allLogs, setAllLogs] = useState([])
  const [loadError, setLoadError] = useState('')
  const [viewDate, setViewDate] = useState(() => todayLocalISO())
  const [pastViewLog, setPastViewLog] = useState(null)
  const [, setPastLogLoading] = useState(false)
  const [attempts, setAttempts] = useState([])
  const [progressAttemptId, setProgressAttemptId] = useState(null)
  const [restartFailureModal, setRestartFailureModal] = useState(null)
  const [restartBusy, setRestartBusy] = useState(false)
  const [challengeSwitchOpen, setChallengeSwitchOpen] = useState(false)
  const [challengeSwitchBusy, setChallengeSwitchBusy] = useState(false)
  const [mealPlanRequest, setMealPlanRequest] = useState('')
  const [mealPlanOutput, setMealPlanOutput] = useState('')
  const [mealPlanGenerating, setMealPlanGenerating] = useState(false)
  const [mealPlanSaveBusy, setMealPlanSaveBusy] = useState(false)
  const [, setMealSlotVariantIndices] = useState([0, 0, 0, 0, 0])
  const [mealSlotLoading, setMealSlotLoading] = useState(null)
  const [mealsMicronOpen, setMealsMicronOpen] = useState(false)
  const [mealElseSlots, setMealElseSlots] = useState(createInitialMealElseSlots)
  const [mealElseRestartBusy, setMealElseRestartBusy] = useState(false)
  const [attemptBannerMessage, setAttemptBannerMessage] = useState('')
  const [macroRecalibratedToast, setMacroRecalibratedToast] = useState('')
  const [activeLogEditSlot, setActiveLogEditSlot] = useState(null)
  const [showMealsBackCta, setShowMealsBackCta] = useState(false)
  const [showWorkoutsBackCta, setShowWorkoutsBackCta] = useState(false)
  const [flipbookOpen, setFlipbookOpen] = useState(false)
  const [flipIndex, setFlipIndex] = useState(0)
  const [flipPlaying, setFlipPlaying] = useState(true)
  const [flipIntervalMs, setFlipIntervalMs] = useState(800)
  const [flipGifBusy, setFlipGifBusy] = useState(false)
  const [flipGifMessage, setFlipGifMessage] = useState('')
  const flipTimerRef = useRef(null)
  const [readingSaveBusy, setReadingSaveBusy] = useState(false)
  const [readingModalOpen, setReadingModalOpen] = useState(false)
  const [readingBooks, setReadingBooks] = useState([])
  const [readingBookChoice, setReadingBookChoice] = useState('')
  const [readingAddNewBook, setReadingAddNewBook] = useState(false)
  const [readingNewBookTitle, setReadingNewBookTitle] = useState('')
  const [readingNewBookTotalPages, setReadingNewBookTotalPages] = useState('')
  const [readingSessionStartPage, setReadingSessionStartPage] = useState('1')
  const [readingSessionEndPage, setReadingSessionEndPage] = useState('10')
  const [progressPhotoBusy, setProgressPhotoBusy] = useState(false)
  const [workoutPrefChips, setWorkoutPrefChips] = useState(['All'])
  const [workoutPrefNotes, setWorkoutPrefNotes] = useState('')
  const [workoutInlineMsg, setWorkoutInlineMsg] = useState('')
  const [assigningSlot, setAssigningSlot] = useState(null)
  const [selectedProgressDate, setSelectedProgressDate] = useState(null)
  const progressPhotoInputRef = useRef(null)
  const workoutsScrollTopRef = useRef(null)
  const workoutListAnchorRef = useRef(null)
  const mealElseSlotsRef = useRef(mealElseSlots)
  const mealCardRefs = useRef(MEAL_SLOT_ORDER.map(() => null))
  const todayLogRef = useRef(null)
  const userIdRef = useRef(null)
  const viewDateRef = useRef(viewDate)

  useEffect(() => {
    todayLogRef.current = todayLog
  }, [todayLog])

  useEffect(() => {
    mealElseSlotsRef.current = mealElseSlots
  }, [mealElseSlots])

  useEffect(() => {
    viewDateRef.current = viewDate
  }, [viewDate])

  useEffect(() => {
    if (!todayLog?.meal_plan) return
    const plan = todayLog.meal_plan
    queueMicrotask(() => {
      setMealPlanOutput((prev) => prev || plan)
    })
  }, [todayLog?.id, todayLog?.meal_plan])

  useEffect(() => {
    queueMicrotask(() => {
      setMealElseSlots(createInitialMealElseSlots())
      setActiveLogEditSlot(null)
    })
  }, [todayLog?.id])

  useEffect(() => {
    if (!macroRecalibratedToast) return undefined
    const tid = window.setTimeout(() => setMacroRecalibratedToast(''), 4500)
    return () => window.clearTimeout(tid)
  }, [macroRecalibratedToast])

  const logsByDate = useMemo(() => {
    const m = new Map()
    for (const row of allLogs) {
      if (row?.date) m.set(row.date, row)
    }
    return m
  }, [allLogs])

  const startDateStr = profile?.start_date ?? todayStr

  const challengeType = useMemo(
    () => normalizeChallengeType(profile?.challenge_type),
    [profile?.challenge_type]
  )
  const challengeHeaderLabel = is75Soft(challengeType) ? '75 SOFT' : '75 HARD'
  const challengeHeaderClass = is75Soft(challengeType) ? 'dash-logo--soft' : 'dash-logo--hard'
  const waterTarget = useMemo(() => waterTargetMl(challengeType), [challengeType])
  const taskSegments = useMemo(() => challengeTaskCount(challengeType), [challengeType])

  const calendarToday = todayLocalISO()
  const displayLog = useMemo(() => {
    if (viewDate === calendarToday) return todayLog
    return pastViewLog ?? emptyDayLog(viewDate)
  }, [viewDate, calendarToday, todayLog, pastViewLog])

  const dayOf75View = useMemo(
    () => challengeDayNumber(startDateStr, viewDate),
    [startDateStr, viewDate]
  )

  const showSoft75CompleteBanner = useMemo(
    () =>
      is75Soft(challengeType) &&
      !progressAttemptId &&
      challengeDayNumber(startDateStr, calendarToday) >= CHALLENGE_DAYS,
    [challengeType, progressAttemptId, startDateStr, calendarToday]
  )

  const arcRadius = 54
  const arcCirc = 2 * Math.PI * arcRadius

  const progressScopedAttempt = useMemo(() => {
    if (!attempts.length) return null
    if (progressAttemptId) {
      return attempts.find((a) => a.id === progressAttemptId) ?? null
    }
    return attempts.find((a) => !a.ended_at) ?? attempts[attempts.length - 1]
  }, [attempts, progressAttemptId])

  useEffect(() => {
    if (!progressAttemptId || !attempts.length) return
    const ok = attempts.some((a) => a.id === progressAttemptId && a.ended_at)
    if (!ok) queueMicrotask(() => setProgressAttemptId(null))
  }, [attempts, progressAttemptId])

  const endedAttemptsSorted = useMemo(
    () =>
      [...attempts]
        .filter((a) => a.ended_at)
        .sort((a, b) => b.attempt_number - a.attempt_number),
    [attempts]
  )

  const isProgressHistoryView = useMemo(
    () => !!(progressAttemptId && progressScopedAttempt?.ended_at),
    [progressAttemptId, progressScopedAttempt?.ended_at]
  )

  const progressStats = useMemo(() => {
    const start = progressScopedAttempt?.start_date ?? startDateStr
    const rawEnd = progressScopedAttempt?.ended_at ?? todayLocalISO()
    const lastChallengeDay = addDaysISO(start, 74)
    const through = minDateStr(rawEnd, lastChallengeDay)
    const currentDay = challengeDayNumber(start, through)
    const daysLeft = Math.max(0, CHALLENGE_DAYS - currentDay)
    const attemptNum = progressScopedAttempt?.attempt_number ?? 1
    return { currentDay, daysLeft, attemptNum }
  }, [progressScopedAttempt, startDateStr])

  const progressMeta = useMemo(() => {
    const a = progressScopedAttempt
    if (!a) return null
    const start = a.start_date
    const rawEnd = a.ended_at ?? todayLocalISO()
    const lastChallengeDay = addDaysISO(start, 74)
    const through = minDateStr(rawEnd, lastChallengeDay)
    let daysCompleted = 0
    for (const log of allLogs) {
      if (!log?.date || log.date < start || log.date > through) continue
      if (isPerfectLog(log, challengeType)) daysCompleted += 1
    }
    if (a.ended_at) {
      return {
        kind: 'past',
        attemptNum: a.attempt_number,
        start,
        ended: a.ended_at,
        daysCompleted,
      }
    }
    return {
      kind: 'active',
      attemptNum: a.attempt_number,
      start,
      daysCompleted,
    }
  }, [progressScopedAttempt, allLogs, challengeType])

  const progressGridDays = useMemo(() => {
    const ct = todayLocalISO()
    const startStr = progressScopedAttempt?.start_date ?? startDateStr
    const showTodayBorder = !!(progressScopedAttempt && !progressScopedAttempt.ended_at)
    const rawEnd = progressScopedAttempt?.ended_at ?? ct
    const lastChallengeDay = addDaysISO(startStr, 74)
    const through = minDateStr(rawEnd, lastChallengeDay)
    const cells = []
    const start = parseISODateLocal(startStr)
    for (let i = 0; i < CHALLENGE_DAYS; i += 1) {
      const dt = new Date(start)
      dt.setDate(dt.getDate() + i)
      const key = formatLocalDate(dt)
      const log = logsByDate.get(key)
      const isToday = !isProgressHistoryView && showTodayBorder && key === ct
      let gridKind = 'future'
      if (key <= through) {
        if (is75Soft(challengeType)) {
          if (!log) gridKind = 'empty'
          else if (isPerfectLog(log, challengeType)) gridKind = 'perfect'
          else gridKind = 'partial'
        } else if (log && isPerfectLog(log, challengeType)) {
          gridKind = 'perfect'
        } else {
          gridKind = 'failed'
        }
      }
      cells.push({
        key,
        log,
        isToday,
        gridKind,
        hasPhoto: !!(log?.progress_photo && String(log.progress_photo).length > 40),
      })
    }
    return cells
  }, [progressScopedAttempt, logsByDate, startDateStr, isProgressHistoryView, challengeType])

  const progressRecent7 = useMemo(() => {
    const start = progressScopedAttempt?.start_date ?? startDateStr
    const rawEnd = progressScopedAttempt?.ended_at ?? todayLocalISO()
    const lastChallengeDay = addDaysISO(start, 74)
    const through = minDateStr(rawEnd, lastChallengeDay)
    const rows = []
    let d = parseISODateLocal(through)
    for (let i = 0; i < 7; i += 1) {
      const key = formatLocalDate(d)
      if (key < start) break
      rows.push({ key, log: logsByDate.get(key) })
      d.setDate(d.getDate() - 1)
    }
    return rows
  }, [progressScopedAttempt, startDateStr, logsByDate])

  const progressPhotosGallery = useMemo(() => {
    const start = progressScopedAttempt?.start_date ?? startDateStr
    const rawEnd = progressScopedAttempt?.ended_at ?? todayLocalISO()
    const lastChallengeDay = addDaysISO(start, 74)
    const through = minDateStr(rawEnd, lastChallengeDay)
    const list = []
    for (const log of allLogs) {
      if (!log?.date || log.date < start || log.date > through) continue
      const ph = log.progress_photo
      if (!ph || typeof ph !== 'string' || ph.length < 50 || !ph.startsWith('data:')) continue
      const dayNum = challengeDayNumber(start, log.date)
      list.push({ date: log.date, dayNum, src: ph, id: log.id })
    }
    list.sort((a, b) => b.date.localeCompare(a.date))
    return list
  }, [allLogs, progressScopedAttempt, startDateStr])

  const progressPhotosFlipOrder = useMemo(
    () => [...progressPhotosGallery].sort((a, b) => a.date.localeCompare(b.date)),
    [progressPhotosGallery]
  )

  const selectedReadingBook = useMemo(
    () => (Array.isArray(readingBooks) ? readingBooks : []).find((b) => b.id === readingBookChoice) ?? null,
    [readingBooks, readingBookChoice]
  )
  const readingLastEndPage = useMemo(() => {
    if (!selectedReadingBook) return 0
    let maxEnd = 0
    const rows = Array.isArray(allLogs) ? allLogs : []
    for (const row of rows) {
      const rl = row?.reading_log
      if (!rl || typeof rl !== 'object') continue
      if (String(rl.book_id || '') !== String(selectedReadingBook.id)) continue
      const end = Number(rl.end_page)
      if (Number.isFinite(end) && end > maxEnd) maxEnd = end
    }
    return maxEnd
  }, [allLogs, selectedReadingBook])

  const refreshAllLogs = useCallback(async (uid) => {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: true })
    const rows = error ? [] : data ?? []
    if (!error && data) setAllLogs(data)
    return rows
  }, [])

  const refreshReadingBooks = useCallback(async (uid) => {
    try {
      const { data, error } = await supabase
        .from('reading_books')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
      if (error) {
        setReadingBooks([])
        return []
      }
      const rows = Array.isArray(data) ? data : []
      setReadingBooks(rows)
      return rows
    } catch {
      setReadingBooks([])
      return []
    }
  }, [])

  const load = useCallback(async () => {
    setLoadError('')
    const t = todayLocalISO()
    setTodayStr(t)

    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) {
      navigate('/', { replace: true })
      return
    }
    const uid = user.id
    userIdRef.current = uid

    const { data: prof, error: pErr } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle()

    if (pErr) {
      setLoadError(pErr.message || 'Could not load profile.')
      setReady(true)
      return
    }
    if (!prof) {
      navigate('/challenge-select', { replace: true })
      return
    }
    if (!isChallengeTypeExplicitlySet(prof.challenge_type)) {
      navigate('/challenge-select', { replace: true })
      return
    }
    const ctLoad = normalizeChallengeType(prof.challenge_type)
    let nextProfile = prof
    const recalculatedMacros = (() => {
      const w = Number(prof.weight_kg)
      const h = Number(prof.height_cm)
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null
      const calc = MACRO_CALC(w, h, prof.gender)
      const soft = is75Soft(ctLoad)
      return {
        calories: calc.calories,
        protein: calc.protein,
        carbs: calc.carbs,
        fat: calc.fat,
        fiber: calc.fiber,
        waterLiters: soft ? 3 : 3.7,
        waterMl: soft ? 3000 : 3700,
      }
    })()
    if (recalculatedMacros) {
      const old = prof.macros ?? {}
      const changed =
        old.calories !== recalculatedMacros.calories ||
        old.protein !== recalculatedMacros.protein ||
        old.carbs !== recalculatedMacros.carbs ||
        old.fat !== recalculatedMacros.fat ||
        old.fiber !== recalculatedMacros.fiber ||
        old.waterLiters !== recalculatedMacros.waterLiters
      if (changed) {
        const { error: macroErr } = await supabase
          .from('user_profiles')
          .update({ macros: recalculatedMacros })
          .eq('user_id', uid)
        if (!macroErr) {
          nextProfile = { ...prof, macros: recalculatedMacros }
          const toastKey = `macro-recalibrated-${uid}`
          if (!window.localStorage.getItem(toastKey)) {
            setMacroRecalibratedToast('Your macro targets have been recalibrated for accuracy.')
            window.localStorage.setItem(toastKey, '1')
          }
        }
      }
    }
    setProfile(nextProfile)

    let { data: attRows, error: attErr } = await supabase
      .from('attempts')
      .select('*')
      .eq('user_id', uid)
      .eq('challenge_type', ctLoad)
      .order('attempt_number', { ascending: true })

    if (!attErr && (!attRows || attRows.length === 0)) {
      const ins = await supabase.from('attempts').insert({
        user_id: uid,
        attempt_number: 1,
        start_date: prof.start_date ?? t,
        challenge_type: ctLoad,
      })
      if (!ins.error) {
        const again = await supabase
          .from('attempts')
          .select('*')
          .eq('user_id', uid)
          .eq('challenge_type', ctLoad)
          .order('attempt_number', { ascending: true })
        attRows = again.data
      }
    } else if (attErr) {
      attRows = []
    }
    setAttempts(attRows ?? [])

    const { data: existing, error: lErr } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', uid)
      .eq('date', t)
      .maybeSingle()

    if (lErr) {
      setLoadError(lErr.message || 'Could not load today’s log.')
      setReady(true)
      return
    }

    let logRow = existing
    if (!logRow) {
      const { data: inserted, error: iErr } = await supabase
        .from('daily_logs')
        .insert({ user_id: uid, date: t })
        .select()
        .single()
      if (iErr) {
        const { data: again } = await supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', uid)
          .eq('date', t)
          .maybeSingle()
        logRow = again
        if (!logRow) {
          setLoadError(iErr.message || 'Could not create today’s log.')
        }
      } else {
        logRow = inserted
      }
    }

    todayLogRef.current = logRow
    setTodayLog(logRow)
    setViewDate(t)

    const logsData = await refreshAllLogs(uid)
    await refreshReadingBooks(uid)

    const activeOnly = (attRows ?? []).find((a) => !a.ended_at)
    if (activeOnly && t !== activeOnly.start_date) {
      const yest = addDaysISO(t, -1)
      if (yest >= activeOnly.start_date) {
        const map = new Map((logsData ?? []).map((r) => [r.date, r]))
        const yLog = map.get(yest)
        const age = attemptAgeDays(activeOnly.start_date, t)
        const failedYesterday = dayFailsHardRules(yLog, age, ctLoad)
        if (failedYesterday) {
          const missedLabels = yLog ? missedRequirementLabels(yLog, ctLoad) : ['No daily log recorded']
          const prevStats = summarizeAttemptThrough(activeOnly, yest, map, ctLoad)
          const nums = (attRows ?? []).map((a) => a.attempt_number)
          const nextNum = (nums.length ? Math.max(...nums) : 0) + 1
          setRestartFailureModal({
            missedDate: yest,
            missedLabels,
            nextAttemptNum: nextNum,
            prevStats,
            prevAttemptNumber: activeOnly.attempt_number,
          })
        }
      }
    }

    setReady(true)
  }, [navigate, refreshAllLogs, refreshReadingBooks])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  useEffect(() => {
    let cancelled = false
    const tid = window.setTimeout(() => {
      const cal = todayLocalISO()
      if (!ready || !userIdRef.current) return
      if (viewDate >= cal) {
        setPastViewLog(null)
        setPastLogLoading(false)
        return
      }
      setPastViewLog(null)
      setPastLogLoading(true)
      ;(async () => {
        const { data, error } = await supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', userIdRef.current)
          .eq('date', viewDate)
          .maybeSingle()
        if (cancelled) {
          setPastLogLoading(false)
          return
        }
        setPastLogLoading(false)
        if (!error) setPastViewLog(data)
      })()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(tid)
    }
  }, [viewDate, ready])

  const persistLogPatch = useCallback(async (patch) => {
    const prev = todayLogRef.current
    if (!prev?.id) return { error: new Error('No log') }
    const next = { ...prev, ...patch }
    todayLogRef.current = next
    setTodayLog(next)
    setAllLogs((logs) => {
      const idx = logs.findIndex((r) => r.id === next.id)
      if (idx === -1) {
        return [...logs, next].sort((a, b) => a.date.localeCompare(b.date))
      }
      const copy = [...logs]
      copy[idx] = next
      return copy
    })
    const { error } = await supabase
      .from('daily_logs')
      .update(patch)
      .eq('id', prev.id)
    return { error }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  const toggleBool = async (field) => {
    if (viewDateRef.current !== todayLocalISO()) return
    const cur = todayLogRef.current
    if (!cur?.id) return
    const was = !!cur[field]
    const next = !was
    const patch = { [field]: next }
    if ((field === 'indoor_done' || field === 'workout_1_done') && !next) {
      patch.indoor_workout = null
      patch.indoor_workout_type = null
      patch.workout_1_name = null
      patch.workout_1_type = null
      patch.workout_voice = null
    }
    if ((field === 'outdoor_done' || field === 'workout_2_done') && !next) {
      patch.outdoor_workout = null
      patch.outdoor_workout_type = null
      patch.workout_2_name = null
      patch.workout_2_type = null
      patch.workout_voice = null
    }
    const { error } = await persistLogPatch(patch)
    if (error) {
      setLoadError(error.message || 'Update failed')
      return
    }
  }

  const addWater = async (ml) => {
    if (viewDateRef.current !== todayLocalISO()) return
    const cur = todayLogRef.current
    if (!cur?.id) return
    const current = cur.water_ml ?? 0
    await persistLogPatch({ water_ml: current + ml })
  }

  const subtractWater = async (ml) => {
    if (viewDateRef.current !== todayLocalISO()) return
    const cur = todayLogRef.current
    if (!cur?.id) return
    const current = cur.water_ml ?? 0
    await persistLogPatch({ water_ml: Math.max(0, current - ml) })
  }

  const executeChallengeRestart = useCallback(
    async (profileExtras = {}) => {
      const uid = userIdRef.current
      if (!uid) return { ok: false, message: 'Not signed in.', nextNum: null }
      const active = attempts.find((a) => !a.ended_at)
      if (!active) return { ok: false, message: 'No active attempt.', nextNum: null }
      const nextChallengeType = normalizeChallengeType(profileExtras.challenge_type ?? challengeType)
      let nums = attempts.map((a) => a.attempt_number)
      if (nextChallengeType !== challengeType) {
        const { data: nextTypeAttempts, error: nextTypeAttemptsErr } = await supabase
          .from('attempts')
          .select('attempt_number')
          .eq('user_id', uid)
          .eq('challenge_type', nextChallengeType)
        if (nextTypeAttemptsErr) {
          return {
            ok: false,
            message: nextTypeAttemptsErr.message || 'Could not read attempts for selected challenge.',
            nextNum: null,
          }
        }
        nums = (nextTypeAttempts ?? []).map((a) => a.attempt_number)
      }
      const nextNum = (nums.length ? Math.max(...nums) : 0) + 1
      const y = addDaysISO(todayLocalISO(), -1)
      const t0 = todayLocalISO()
      const { error: e1 } = await supabase
        .from('attempts')
        .update({ ended_at: y })
        .eq('id', active.id)
      if (e1) return { ok: false, message: e1.message || 'Could not end current attempt.', nextNum: null }
      const { error: e2 } = await supabase.from('attempts').insert({
        user_id: uid,
        attempt_number: nextNum,
        start_date: t0,
        challenge_type: nextChallengeType,
      })
      if (e2) return { ok: false, message: e2.message || 'Could not start new attempt.', nextNum: null }
      const { error: e3 } = await supabase
        .from('user_profiles')
        .update({ start_date: t0, ...profileExtras })
        .eq('user_id', uid)
      if (e3) return { ok: false, message: e3.message || 'Could not update profile.', nextNum: null }
      setProgressAttemptId(null)
      await load()
      return { ok: true, message: '', nextNum }
    },
    [attempts, challengeType, load]
  )

  const performRestartAttempt = useCallback(async () => {
    setRestartBusy(true)
    setLoadError('')
    const res = await executeChallengeRestart({})
    setRestartBusy(false)
    if (!res.ok) {
      setLoadError(res.message)
      return
    }
    setRestartFailureModal(null)
  }, [executeChallengeRestart])

  const handleUpgradeTo75HardFromSoftBanner = async () => {
    setChallengeSwitchBusy(true)
    setLoadError('')
    const res = await executeChallengeRestart({
      challenge_type: CHALLENGE_75_HARD,
      challenge_completed_at: null,
    })
    setChallengeSwitchBusy(false)
    if (!res.ok) {
      setLoadError(res.message)
      return
    }
    setTab('today')
    setAttemptBannerMessage('Welcome to 75 HARD — fresh attempt started today.')
  }

  const confirmSwitchChallenge = async () => {
    setChallengeSwitchBusy(true)
    setLoadError('')
    const next =
      challengeType === CHALLENGE_75_SOFT ? CHALLENGE_75_HARD : CHALLENGE_75_SOFT
    const res = await executeChallengeRestart({
      challenge_type: next,
      challenge_completed_at: null,
    })
    setChallengeSwitchBusy(false)
    setChallengeSwitchOpen(false)
    if (!res.ok) {
      setLoadError(res.message)
      return
    }
    setTab('today')
    setAttemptBannerMessage(
      next === CHALLENGE_75_HARD
        ? 'Switched to 75 HARD — new attempt from today.'
        : 'Switched to 75 Soft — new attempt from today.'
    )
  }

  const logWorkoutToSlot = async (slot, workoutName, locationType, opts = {}) => {
    if (viewDateRef.current !== todayLocalISO()) return
    const cur = todayLogRef.current
    if (!cur?.id || !workoutName) return
    const patch =
      slot === 1
        ? {
            workout_1_done: true,
            workout_1_name: workoutName,
            workout_1_type: locationType,
            workout_voice: null,
          }
        : {
            workout_2_done: true,
            workout_2_name: workoutName,
            workout_2_type: locationType,
            workout_voice: null,
          }
    const { error } = await persistLogPatch(patch)
    if (error) setLoadError(error.message || 'Could not log workout')
    else {
      if (opts.fromAssignMode) {
        setAssigningSlot(null)
        window.setTimeout(() => {
          workoutsScrollTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 80)
      }
      setShowWorkoutsBackCta(true)
      setWorkoutInlineMsg(`Workout ${slot} logged ✓`)
      window.setTimeout(() => setWorkoutInlineMsg(''), 1800)
    }
  }

  const beginAssignWorkout = (slot) => {
    setAssigningSlot(slot)
    window.setTimeout(() => {
      workoutListAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  useEffect(() => {
    if (!readingModalOpen) return
    const rl = todayLog?.reading_log
    if (rl && typeof rl === 'object') {
      queueMicrotask(() => {
        if (rl.book_id) setReadingBookChoice(String(rl.book_id))
        if (rl.start_page != null) setReadingSessionStartPage(String(rl.start_page))
        if (rl.end_page != null) setReadingSessionEndPage(String(rl.end_page))
      })
      return
    }
    if (!readingBookChoice && readingBooks.length) {
      queueMicrotask(() => setReadingBookChoice(String(readingBooks[0].id)))
    }
  }, [readingModalOpen, todayLog?.reading_log, readingBooks, readingBookChoice])

  useEffect(() => {
    if (!readingModalOpen || !selectedReadingBook) return
    if (todayLog?.reading_log?.book_id === selectedReadingBook.id) return
    const start = Math.max(1, readingLastEndPage + 1)
    queueMicrotask(() => {
      setReadingSessionStartPage(String(start))
      setReadingSessionEndPage(String(start + 9))
    })
  }, [readingModalOpen, selectedReadingBook, readingLastEndPage, todayLog?.reading_log])

  useEffect(() => {
    queueMicrotask(() => {
      if (tab !== 'meals') setShowMealsBackCta(false)
      if (tab !== 'workouts') {
        setShowWorkoutsBackCta(false)
        setAssigningSlot(null)
      }
      if (tab === 'progress' && !selectedProgressDate) {
        setSelectedProgressDate(todayLocalISO())
      }
    })
  }, [tab, selectedProgressDate])

  useEffect(() => {
    if (!flipbookOpen || !flipPlaying || progressPhotosFlipOrder.length < 2) {
      if (flipTimerRef.current) {
        window.clearInterval(flipTimerRef.current)
        flipTimerRef.current = null
      }
      return undefined
    }
    const ms = Math.max(200, flipIntervalMs)
    flipTimerRef.current = window.setInterval(() => {
      setFlipIndex((i) => {
        const n = progressPhotosFlipOrder.length
        return n ? (i + 1) % n : 0
      })
    }, ms)
    return () => {
      if (flipTimerRef.current) {
        window.clearInterval(flipTimerRef.current)
        flipTimerRef.current = null
      }
    }
  }, [flipbookOpen, flipPlaying, flipIntervalMs, progressPhotosFlipOrder.length])

  const downloadFlipbookGif = useCallback(() => {
    const gs = typeof window !== 'undefined' ? window.gifshot : null
    if (!gs?.createGIF) {
      setFlipGifMessage('Download not supported in this browser — screen record instead.')
      return
    }
    setFlipGifBusy(true)
    setFlipGifMessage('')
    const images = progressPhotosFlipOrder.map((p) => p.src)
    gs.createGIF(
      {
        gifWidth: 400,
        gifHeight: 400,
        interval: Math.max(0.2, flipIntervalMs / 1000),
        images,
      },
      (obj) => {
        setFlipGifBusy(false)
        if (obj?.error) {
          setFlipGifMessage('Download not supported in this browser — screen record instead.')
          return
        }
        const a = document.createElement('a')
        a.href = obj.image
        a.download = '75hard-progress.gif'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    )
  }, [progressPhotosFlipOrder, flipIntervalMs])

  const saveReadingLog = async (markDone = false) => {
    if (viewDateRef.current !== todayLocalISO()) return
    const cur = todayLogRef.current
    if (!cur?.id) return
    setLoadError('')
    let book = selectedReadingBook
    if (readingAddNewBook) {
      const t = readingNewBookTitle.trim()
      const total = Number(readingNewBookTotalPages)
      if (!t || !Number.isFinite(total) || total <= 0) {
        setLoadError('Enter a valid new book title and total pages.')
        return false
      }
      const uid = userIdRef.current
      if (!uid) return false
      const { data: inserted, error: bErr } = await supabase
        .from('reading_books')
        .insert({ user_id: uid, title: t, total_pages: total })
        .select('*')
        .single()
      if (bErr || !inserted) {
        setLoadError(bErr?.message || 'Could not save book.')
        return false
      }
      await refreshReadingBooks(uid)
      setReadingBookChoice(inserted.id)
      setReadingAddNewBook(false)
      book = inserted
    }
    if (!book) {
      setLoadError('Select a book first.')
      return false
    }
    const startPage = Number(readingSessionStartPage)
    const endPage = Number(readingSessionEndPage)
    if (!Number.isFinite(startPage) || !Number.isFinite(endPage) || startPage <= 0 || endPage < startPage) {
      setLoadError('Enter valid start/end pages.')
      return false
    }
    const pagesToday = endPage - startPage + 1
    if (pagesToday < 10) {
      setLoadError('Minimum 10 pages required.')
      return false
    }
    const totalPages = Number(book.total_pages) || endPage
    const percentComplete = Math.min(100, (endPage / Math.max(1, totalPages)) * 100)
    setReadingSaveBusy(true)
    const payload = {
      book_id: book.id,
      book_title: book.title,
      start_page: startPage,
      end_page: endPage,
      pages_today: pagesToday,
      total_pages: totalPages,
      percent_complete: percentComplete,
      logged_at: new Date().toISOString(),
    }
    const { error } = await persistLogPatch({ reading_log: payload })
    setReadingSaveBusy(false)
    if (error) {
      setLoadError(error.message || 'Could not save reading log.')
      return false
    }
    if (markDone && !todayLogRef.current?.reading_done) {
      const doneRes = await persistLogPatch({ reading_done: true })
      if (doneRes.error) {
        setLoadError(doneRes.error.message || 'Could not mark reading as done.')
        return false
      }
    }
    return true
  }

  const onProgressPhotoFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    if (viewDateRef.current !== todayLocalISO()) return
    const cur = todayLogRef.current
    if (!cur?.id) return
    setProgressPhotoBusy(true)
    setLoadError('')
    try {
      const dataUrl = await imageFileToJpegDataUrl(file)
      if (dataUrl.length > 4_500_000) {
        setLoadError('Image is still too large after resize. Try a smaller photo.')
        return
      }
      const { error } = await persistLogPatch({ progress_photo: dataUrl })
      if (error) setLoadError(error.message || 'Upload failed')
    } catch {
      setLoadError('Could not process image.')
    } finally {
      setProgressPhotoBusy(false)
    }
  }

  const generateMealPlan = async () => {
    if (!profile) return
    setMealPlanGenerating(true)
    setLoadError('')
    const zeros = [0, 0, 0, 0, 0]
    setMealSlotVariantIndices(zeros)
    try {
      const prompt = buildMealPlanPrompt(profile, mealPlanRequest)
      let text = ''
      try {
        const raw = await fetchMealPlanFromAnthropic(prompt)
        text = (raw || '').trim()
      } catch {
        text = ''
      }
      setMealPlanOutput(
        text ? text : fallbackMealPlanText(profile, mealPlanRequest, zeros)
      )
    } finally {
      setMealPlanGenerating(false)
    }
  }

  const refreshMealSlot = async (slotIndex) => {
    if (!profile || !mealPlanOutput.trim()) return
    if (mealPlanGenerating) return
    setMealSlotLoading(slotIndex)
    try {
      const parsed = parseSpecialRequest(mealPlanRequest)
      const prompt = buildSingleMealPrompt(
        profile,
        slotIndex,
        parsed,
        profile.macros ?? {}
      )
      const raw = await fetchMealPlanFromAnthropic(prompt)
      const line = cleanSingleMealResponse(raw, slotIndex)
      if (line && MACRO_TAIL_RE.test(line)) {
        setMealPlanOutput((prev) => replaceSegmentInPlan(prev, slotIndex, line))
      } else {
        throw new Error('meal')
      }
    } catch {
      setMealSlotVariantIndices((prevIdxs) => {
        const nextIdxs = [...prevIdxs]
        nextIdxs[slotIndex] = (nextIdxs[slotIndex] + 1) % 3
        const slotKey = MEAL_SLOT_ORDER[slotIndex]
        const tier = mealTiersForDiet(profile.diet_type)[slotKey]
        const newLine = tier[nextIdxs[slotIndex] % tier.length]
        setMealPlanOutput((prev) => replaceSegmentInPlan(prev, slotIndex, newLine))
        return nextIdxs
      })
    } finally {
      setMealSlotLoading(null)
    }
  }

  const saveMealPlanToLog = async () => {
    if (viewDateRef.current !== todayLocalISO()) return
    const cur = todayLogRef.current
    if (!cur?.id) return
    const body = (mealPlanOutput ?? '').trim()
    if (!body) return
    setMealPlanSaveBusy(true)
    setLoadError('')
    const { error } = await persistLogPatch({ meal_plan: body })
    setMealPlanSaveBusy(false)
    if (error) setLoadError(error.message || 'Could not save meal plan.')
  }

  const calculateActualMealForSlot = async (slotIndex) => {
    const draft = (mealElseSlotsRef.current[slotIndex]?.draft ?? '').trim()
    if (!draft) return
    setMealElseSlots((prev) => {
      const n = [...prev]
      n[slotIndex] = {
        ...n[slotIndex],
        loading: true,
        breakdownLoading: true,
        result: null,
        breakdown: null,
      }
      return n
    })
    let cleanAssessment
    let parsedItems
    try {
      const raw = await fetchMealAnalysisFromAnthropic(draft)
      cleanAssessment = parseMealAnalysisJson(raw)
    } catch {
      cleanAssessment = null
    }
    try {
      const raw = await fetchMealBreakdownFromAnthropic(draft)
      parsedItems = parseMealBreakdownJson(raw)
    } catch {
      parsedItems = null
    }
    let breakdown = deterministicBreakdownFromItems(null, draft)
    if (!breakdown?.length) breakdown = deterministicBreakdownFromItems(parsedItems, draft)
    if (!breakdown?.length) breakdown = fallbackBreakdownFromFoodDb(draft)
    const fallbackBase = keywordMealFallbackAnalysis(draft)
    const t = totalsFromBreakdown(breakdown) ?? fallbackBase
    const analysis = {
      ...(cleanAssessment ?? fallbackBase),
      calories: Math.round(t.calories || 0),
      protein_g: Math.round((t.protein_g || 0) * 10) / 10,
      carbs_g: Math.round((t.carbs_g || 0) * 10) / 10,
      fat_g: Math.round((t.fat_g || 0) * 10) / 10,
      fiber_g: Math.round((t.fiber_g || 0) * 10) / 10,
    }
    setMealElseSlots((prev) => {
      const n = [...prev]
      n[slotIndex] = {
        ...n[slotIndex],
        loading: false,
        breakdownLoading: false,
        result: analysis,
        breakdown,
      }
      return n
    })
    setActiveLogEditSlot(null)
  }

  const logActualMealForSlot = async (slotIndex) => {
    if (viewDateRef.current !== todayLocalISO()) return
    const cur = todayLogRef.current
    if (!cur?.id) return
    const slot = mealElseSlotsRef.current[slotIndex]
    const analysis = slot?.result
    const draft = (slot?.draft ?? '').trim()
    const soft = is75Soft(normalizeChallengeType(profile?.challenge_type))
    if (!analysis || !draft) return
    if (!soft && !analysis.is_clean_diet) return
    setMealElseSlots((prev) => {
      const n = [...prev]
      n[slotIndex] = { ...n[slotIndex], logging: true }
      return n
    })
    setLoadError('')
    const entry = {
      meal_slot: MEAL_SLOT_ORDER[slotIndex],
      description: draft,
      calories: analysis.calories,
      protein_g: analysis.protein_g,
      carbs_g: analysis.carbs_g,
      fat_g: analysis.fat_g,
      fiber_g: analysis.fiber_g,
      is_clean: !!analysis.is_clean_diet,
      logged_at: new Date().toISOString(),
      source: slot?.mode === 'edited' ? 'edited' : 'custom',
      modified_from_suggestion: !!slot?.modifiedFromSuggestion,
      items_breakdown: sanitizeMealBreakdownForStorage(slot?.breakdown),
    }
    const prevMeals = Array.isArray(cur.actual_meals) ? [...cur.actual_meals] : []
    const nextMeals = [
      ...prevMeals.filter((m) => slotIndexFromMealSlotKey(m?.meal_slot) !== slotIndex),
      entry,
    ]
    const totals = sumActualMacrosFromMeals(nextMeals)
    const { error } = await persistLogPatch({
      actual_meals: nextMeals,
      actual_macros_total: totals,
    })
    if (error) {
      setMealElseSlots((prev) => {
        const n = [...prev]
        n[slotIndex] = { ...n[slotIndex], logging: false }
        return n
      })
      setLoadError(error.message || 'Could not log meal.')
      return
    }
    setMealElseSlots((prev) => {
      const n = [...prev]
      n[slotIndex] = {
        expanded: false,
        draft: '',
        mode: 'custom',
        loading: false,
        breakdownLoading: false,
        logging: false,
        result: null,
        breakdown: null,
        modifiedFromSuggestion: false,
      }
      return n
    })
    setShowMealsBackCta(true)
  }

  const dismissDirtyMealSlot = (slotIndex) => {
    setMealElseSlots((prev) => {
      const n = [...prev]
      n[slotIndex] = {
        ...n[slotIndex],
        result: null,
        draft: '',
        mode: 'custom',
        loading: false,
        breakdownLoading: false,
        breakdown: null,
        modifiedFromSuggestion: false,
      }
      return n
    })
    setActiveLogEditSlot(null)
  }

  const restartChallengeFromMeals = async () => {
    setMealElseRestartBusy(true)
    setLoadError('')
    const res = await executeChallengeRestart({})
    setMealElseRestartBusy(false)
    if (!res.ok) {
      setLoadError(res.message)
      return
    }
    setMealElseSlots(createInitialMealElseSlots())
    setActiveLogEditSlot(null)
    setTab('today')
    setAttemptBannerMessage(`Attempt #${res.nextNum} started. You've got this.`)
  }

  const macros = profile?.macros ?? EMPTY_MACROS_FALLBACK

  const actualNutritionTracker = useMemo(() => {
    const meals = Array.isArray(todayLog?.actual_meals) ? todayLog.actual_meals : []
    if (!meals.length) return null
    const totals = sumActualMacrosFromMeals(meals)
    const targets = {
      calories: Number(macros.calories) || 0,
      protein_g: Number(macros.protein) || 0,
      carbs_g: Number(macros.carbs) || 0,
      fat_g: Number(macros.fat) || 0,
      fiber_g: Number(macros.fiber) || 0,
    }
    const keys = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g']
    const labels = {
      calories: 'Calories',
      protein_g: 'Protein',
      carbs_g: 'Carbs',
      fat_g: 'Fat',
      fiber_g: 'Fiber',
    }
    const rows = keys.map((key) => {
      const act = totals[key] ?? 0
      const tgt = targets[key] ?? 0
      let pct = 0
      if (tgt > 0) pct = Math.min(150, (act / tgt) * 100)
      const tone =
        tgt <= 0
          ? 'gray'
          : act >= tgt * 0.9 && act <= tgt * 1.1
            ? 'green'
            : act > tgt * 1.1
              ? 'red'
              : 'orange'
      return { key, label: labels[key], act, tgt, pct, tone }
    })
    return { totals, targets, rows, loggedCount: meals.length }
  }, [todayLog, macros])

  const todayMealsLogged = useMemo(() => {
    const meals = Array.isArray(todayLog?.actual_meals) ? todayLog.actual_meals : []
    return meals.length
  }, [todayLog])

  const hasNonCleanMeal = useMemo(() => {
    const meals = Array.isArray(todayLog?.actual_meals) ? todayLog.actual_meals : []
    return meals.some((m) => m?.is_clean === false)
  }, [todayLog])

  const workout1 = useMemo(
    () => ({
      done: workout1Done(displayLog),
      name: displayLog?.workout_1_name ?? displayLog?.indoor_workout ?? '',
      type: workout1Type(displayLog),
    }),
    [displayLog]
  )
  const workout2 = useMemo(
    () => ({
      done: workout2Done(displayLog),
      name: displayLog?.workout_2_name ?? displayLog?.outdoor_workout ?? '',
      type: workout2Type(displayLog),
    }),
    [displayLog]
  )

  const todayTaskDoneCount = useMemo(() => {
    if (!displayLog) return 0
    if (is75Soft(challengeType)) {
      let count = 0
      if (displayLog.diet_done) count += 1
      if (workout1Done(displayLog)) count += 1
      if (displayLog.reading_done) count += 1
      if (isWaterDone(displayLog, challengeType)) count += 1
      if (displayLog.is_recovery_day) count += 1
      return count
    }
    const indoorType = String(workout1.type || 'indoor')
    const outdoorType = String(workout2.type || 'outdoor')
    const wFail =
      !!workout1.done &&
      !!workout2.done &&
      indoorType === 'indoor' &&
      outdoorType === 'indoor'
    let count = 0
    if (displayLog.diet_done) count += 1
    if (workout1.done && !wFail) count += 1
    if (workout2.done && !wFail) count += 1
    if (displayLog.reading_done) count += 1
    if (displayLog.photo_done) count += 1
    if (isWaterDone(displayLog, challengeType)) count += 1
    return count
  }, [displayLog, workout1, workout2, challengeType])

  const todayTaskProgressPct = Math.round((todayTaskDoneCount / Math.max(1, taskSegments)) * 100)

  const cleanDietSubtitle = useMemo(() => {
    if (todayMealsLogged <= 0) return 'Tap › to log your meals'
    return `${todayMealsLogged} meals logged ✓`
  }, [todayMealsLogged])

  const readingSubtitle = useMemo(() => {
    const rl = displayLog?.reading_log
    if (rl && typeof rl === 'object' && (rl.book_title || rl.end_page != null)) {
      const title = rl.book_title ? String(rl.book_title).trim() : 'Reading'
      if (rl.start_page != null && rl.end_page != null && rl.percent_complete != null) {
        return `📖 ${title} · pages ${rl.start_page}-${rl.end_page} · ${Math.round(Number(rl.percent_complete) || 0)}% complete`
      }
      const pages = rl.pages_today != null ? rl.pages_today : 10
      return `📖 ${title} · ${pages} pages`
    }
    return 'Non-fiction · 10 pages minimum'
  }, [displayLog?.reading_log])

  const workoutRuleFail = useMemo(() => {
    if (is75Soft(challengeType)) return false
    return workoutRuleViolated(displayLog)
  }, [displayLog, challengeType])

  const ringMotivation = useMemo(() => {
    if (is75Soft(challengeType)) {
      if (todayTaskDoneCount === 0) return "Gentle start — one task at a time. You've got this."
      if (todayTaskDoneCount <= 2) return 'Nice momentum — keep it kind and steady.'
      if (todayTaskDoneCount === 3) return 'Halfway there — proud of you for showing up.'
      if (todayTaskDoneCount < taskSegments)
        return 'Almost wrapped — finish on your terms, no pressure.'
      return 'Beautiful consistency today — habits are sticking.'
    }
    if (todayTaskDoneCount === 0) return "Every champion starts here. Let's go. 🔥"
    if (todayTaskDoneCount <= 2) return 'Good start — keep building momentum'
    if (todayTaskDoneCount === 3) return "Halfway through the day. Don't stop now 💪"
    if (todayTaskDoneCount <= 5) return 'Almost there — finish what you started!'
    return 'PERFECT DAY! You crushed it 🏆'
  }, [todayTaskDoneCount, challengeType, taskSegments])

  const recoveryWeekBlocked = useMemo(() => {
    if (!is75Soft(challengeType) || viewDate !== calendarToday || !todayLog?.date) return false
    if (todayLog?.is_recovery_day) return false
    return recoveryDayUsedElsewhereInWeek(allLogs, calendarToday, todayLog.date)
  }, [challengeType, viewDate, calendarToday, todayLog, allLogs])

  const toggleRecoveryDay = async () => {
    if (!is75Soft(challengeType)) return
    if (viewDateRef.current !== todayLocalISO()) return
    const cur = todayLogRef.current
    if (!cur?.id) return
    const turningOn = !cur.is_recovery_day
    if (turningOn && recoveryWeekBlocked) return
    if (turningOn) {
      const { error } = await persistLogPatch({
        is_recovery_day: true,
        workout_1_done: true,
        indoor_done: true,
        workout_1_name: 'Active recovery',
        workout_1_type: 'indoor',
      })
      if (error) setLoadError(error.message || 'Update failed')
    } else {
      const { error } = await persistLogPatch({
        is_recovery_day: false,
        workout_1_done: false,
        indoor_done: false,
        workout_1_name: null,
        workout_1_type: null,
      })
      if (error) setLoadError(error.message || 'Update failed')
    }
  }

  useEffect(() => {
    if (viewDate !== calendarToday) return
    const cur = todayLogRef.current
    if (!cur?.id) return
    const patch = {}
    if ((cur.actual_meals?.length ?? 0) >= 3 && !hasNonCleanMeal && !cur.diet_done) patch.diet_done = true
    if (!is75Soft(challengeType) && cur.progress_photo && !cur.photo_done) patch.photo_done = true
    const wt = waterTargetMl(challengeType)
    if ((cur.water_ml ?? 0) >= wt && !cur.water_done) patch.water_done = true
    if (Object.keys(patch).length) {
      void persistLogPatch(patch)
    }
  }, [
    viewDate,
    calendarToday,
    todayLog?.id,
    todayLog?.actual_meals,
    todayLog?.progress_photo,
    todayLog?.water_ml,
    hasNonCleanMeal,
    persistLogPatch,
    challengeType,
  ])

  const loggedMealsBySlot = useMemo(() => {
    const map = new Map()
    const meals = Array.isArray(todayLog?.actual_meals) ? todayLog.actual_meals : []
    for (const m of meals) {
      if (!m?.meal_slot) continue
      map.set(m.meal_slot, m)
    }
    return map
  }, [todayLog])

  const mealSlotStatus = useMemo(() => {
    return MEAL_SLOT_ORDER.map((slot, i) => {
      const logged = loggedMealsBySlot.get(slot)
      if (logged) return { slot, idx: i, status: logged.is_clean === false ? 'bad' : 'logged' }
      const pendingBad = mealElseSlots[i]?.result && !mealElseSlots[i].result.is_clean_diet
      if (pendingBad) return { slot, idx: i, status: 'bad' }
      return { slot, idx: i, status: 'idle' }
    })
  }, [loggedMealsBySlot, mealElseSlots])

  const nutritionCompletionSummary = useMemo(() => {
    if (!actualNutritionTracker || actualNutritionTracker.loggedCount < 5) return null
    const off = actualNutritionTracker.rows.filter(
      (r) => r.tgt > 0 && (r.act < r.tgt * 0.85 || r.act > r.tgt * 1.15)
    )
    if (!off.length) {
      return { tone: 'ok', text: 'Nutrition complete for today 🎯' }
    }
    const msg = off
      .map((r) => `${r.label} ${r.act > r.tgt ? 'over' : 'under'}`)
      .join(' · ')
    return { tone: 'warn', text: `All meals logged, but macros are off: ${msg}` }
  }, [actualNutritionTracker])

  const mealPlanSplit = useMemo(() => {
    if (!mealPlanOutput.trim()) return null
    return splitMealPlan(mealPlanOutput)
  }, [mealPlanOutput])

  const structuredMealsOk = useMemo(() => {
    if (!mealPlanSplit) return false
    return mealPlanSplit.segments.every((s) => Array.isArray(s.lines) && s.lines.length > 0)
  }, [mealPlanSplit])

  const mealPlanBadges = useMemo(() => {
    if (!mealPlanSplit) return []
    const segs = structuredMealsOk
      ? mealPlanSplit.segments
      : [{ lines: [mealPlanOutput.trim()] }]
    return computeMealPlanBadges(parseSpecialRequest(mealPlanRequest), segs)
  }, [mealPlanRequest, mealPlanSplit, mealPlanOutput, structuredMealsOk])

  const mealSlotsSplit = useMemo(() => {
    if (structuredMealsOk && mealPlanSplit?.segments?.length === 5) return mealPlanSplit
    return splitMealPlan(MEAL_HEADER_PREFIX.join('\n'))
  }, [structuredMealsOk, mealPlanSplit])

  const workoutCatalog = useMemo(
    () => [
      ...WORKOUT_DB.indoor.map((w) => ({ ...w, location: 'indoor' })),
      ...WORKOUT_DB.outdoor.map((w) => ({ ...w, location: 'outdoor' })),
    ],
    []
  )
  const filteredWorkouts = useMemo(() => {
    const chip = workoutPrefChips[0] || 'All'
    const noteRaw = (workoutPrefNotes || '').trim()
    const note = noteRaw.toLowerCase()
    const noteKeywordRe =
      /\b(sore|tired|legs|knee|ankle|energetic|pumped|strong|recovery|rest)\b/gi
    const remainder = noteRaw
      .replace(noteKeywordRe, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()

    const hasRecoveryRest = /\b(recovery|rest)\b/i.test(note)
    const hasSoreBand = /\b(sore|tired|legs|knee|ankle)\b/i.test(note)
    const hasEnergy = /\b(energetic|pumped|strong)\b/i.test(note)

    let onlyFlexibility = false
    let excludeStrength = false
    let strengthFirst = false
    if (hasRecoveryRest) {
      onlyFlexibility = true
    } else if (hasSoreBand) {
      excludeStrength = true
    } else if (hasEnergy) {
      strengthFirst = true
    }

    const list = workoutCatalog.filter((w) => {
      const text = `${w.name} ${w.desc}`.toLowerCase()
      let chipMatch = true
      if (chip === 'Cardio') chipMatch = w.type === 'cardio'
      else if (chip === 'Flexibility') chipMatch = w.type === 'flexibility'
      else if (chip === 'Core') chipMatch = /core|plank/.test(text)
      else if (chip === 'Upper Body') chipMatch = /upper|push|pull|chest|back|shoulder|arms/.test(text)
      else if (chip === 'Lower Body') chipMatch = /lower|leg|squat|lunge|hill|glute/.test(text)
      else if (chip === 'Full Body') chipMatch = /full[- ]?body|circuit/.test(text)
      else if (chip === 'Recovery') chipMatch = w.type === 'flexibility'
      if (!chipMatch) return false
      if (onlyFlexibility) {
        if (w.type !== 'flexibility') return false
      } else if (excludeStrength) {
        if (w.type === 'strength') return false
        if (w.type !== 'cardio' && w.type !== 'flexibility') return false
      }
      if (remainder && !text.includes(remainder)) return false
      return true
    })

    if (!strengthFirst) return list
    return [...list].sort((a, b) => {
      const sa = a.type === 'strength' ? 0 : 1
      const sb = b.type === 'strength' ? 0 : 1
      if (sa !== sb) return sa - sb
      return `${a.location}-${a.name}`.localeCompare(`${b.location}-${b.name}`)
    })
  }, [workoutCatalog, workoutPrefChips, workoutPrefNotes])

  if (!ready) {
    return <div className="dashboard-loading">Loading…</div>
  }

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-header-inner">
          <span className={`dash-logo ${challengeHeaderClass}`}>{challengeHeaderLabel}</span>
          <button type="button" className="dash-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="dash-main">
        {macroRecalibratedToast ? (
          <p className="dash-macro-toast" role="status">
            {macroRecalibratedToast}
          </p>
        ) : null}
        {loadError ? <p className="dash-error">{loadError}</p> : null}

        {tab === 'today' && profile && displayLog && (
          <>
            {attemptBannerMessage ? (
              <div className="dash-attempt-banner" role="status">
                <p className="dash-attempt-banner-text">{attemptBannerMessage}</p>
                <button
                  type="button"
                  className="dash-attempt-banner-dismiss"
                  onClick={() => setAttemptBannerMessage('')}
                >
                  Dismiss
                </button>
              </div>
            ) : null}
            <h1 className="dash-section-title dash-mission-title">DAY {dayOf75View}</h1>
            <p className="dash-muted dash-day-sub">of 75 · {formatLongDate(viewDate)}</p>

            <div className="dash-arc-wrap">
              <div
                className="dash-arc"
                aria-label={`Today's progress ${todayTaskDoneCount} of ${taskSegments} tasks`}
              >
                <svg width="160" height="160" viewBox="0 0 120 120">
                  <circle className="dash-arc-bg" cx="60" cy="60" r={arcRadius} />
                  <circle
                    className="dash-arc-fill"
                    cx="60"
                    cy="60"
                    r={arcRadius}
                    strokeDasharray={arcCirc}
                    strokeDashoffset={arcCirc * (1 - todayTaskProgressPct / 100)}
                  />
                </svg>
                <div className="dash-arc-label">
                  <span className="dash-arc-pct">{todayTaskProgressPct}%</span>
                  <span className="dash-arc-sub">COMPLETE</span>
                </div>
              </div>
            </div>
            <p
              className={`dash-mission-motivation${todayTaskDoneCount >= taskSegments ? ' dash-mission-motivation--perfect' : ''}`}
            >
              {ringMotivation}
            </p>

            <div
              className={`dash-energy-bar${todayTaskDoneCount >= taskSegments ? ' dash-energy-bar--full' : ''}`}
            >
              {Array.from({ length: taskSegments }, (_, i) => (
                <span
                  key={`seg-${i}`}
                  className={`dash-energy-seg${i < todayTaskDoneCount ? ' dash-energy-seg--on' : ''}`}
                />
              ))}
            </div>

            <div className="dash-checklist">
              <div className={`dash-mission-card${displayLog.diet_done ? ' dash-mission-card--done' : ''}`}>
                <button
                  type="button"
                  className={`dash-check dash-check--fill ${displayLog.diet_done ? 'dash-check--on' : ''}`}
                  onClick={() => toggleBool('diet_done')}
                >
                  <span className="dash-check-box" aria-hidden>{displayLog.diet_done ? '✓' : ''}</span>
                  <span className="dash-check-body">
                    <p className="dash-check-title">
                      {is75Soft(challengeType) ? 'Eat well' : 'Clean diet'}
                    </p>
                    <p className={`dash-check-sub ${todayMealsLogged > 0 ? 'dash-check-sub--good' : 'dash-check-sub--warn'}`}>
                      {cleanDietSubtitle}
                    </p>
                  </span>
                </button>
                <button type="button" className="dash-check-jump" onClick={() => setTab('meals')}>›</button>
              </div>

              {is75Soft(challengeType) ? (
                <div className={`dash-mission-card${workout1.done ? ' dash-mission-card--done' : ''}`}>
                  <button
                    type="button"
                    className={`dash-check dash-check--fill ${workout1.done ? 'dash-check--on' : ''}`}
                    onClick={() => toggleBool('workout_1_done')}
                  >
                    <span className="dash-check-box" aria-hidden>
                      {workout1.done ? (displayLog.is_recovery_day ? '🧘' : '✓') : ''}
                    </span>
                    <span className="dash-check-body">
                      <p className="dash-check-title">Workout · 45 min</p>
                      <p className={`dash-check-sub ${workout1.done ? 'dash-check-sub--good' : ''}`}>
                        {displayLog.is_recovery_day
                          ? '🧘 Recovery day — light activity counts'
                          : workout1.done
                            ? workout1.name || 'Logged ✓'
                            : 'Tap › to log workout'}
                      </p>
                    </span>
                  </button>
                  <button type="button" className="dash-check-jump" onClick={() => setTab('workouts')}>
                    ›
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className={`dash-mission-card${workout1.done && !workoutRuleFail ? ' dash-mission-card--done' : workout1.done ? ' dash-mission-card--partial' : ''}`}
                  >
                    <button
                      type="button"
                      className={`dash-check dash-check--fill ${workout1.done && !workoutRuleFail ? 'dash-check--on' : ''}`}
                      onClick={() => toggleBool('workout_1_done')}
                    >
                      <span className="dash-check-box" aria-hidden>{workout1.done ? '✓' : ''}</span>
                      <span className="dash-check-body">
                        <p className="dash-check-title">
                          Workout 1{' '}
                          {workout1.type ? (
                            <span className="dash-workout-type-badge">
                              {String(workout1.type).toUpperCase()}
                            </span>
                          ) : null}
                        </p>
                        <p
                          className={`dash-check-sub ${workout1.done && !workoutRuleFail ? 'dash-check-sub--good' : ''}`}
                        >
                          {workout1.done ? workout1.name || 'Logged ✓' : 'Tap › to log workout'}
                        </p>
                      </span>
                    </button>
                    <button type="button" className="dash-check-jump" onClick={() => setTab('workouts')}>
                      ›
                    </button>
                  </div>

                  <div
                    className={`dash-mission-card${workout2.done && !workoutRuleFail ? ' dash-mission-card--done' : workout2.done ? ' dash-mission-card--partial' : ''}`}
                  >
                    <button
                      type="button"
                      className={`dash-check dash-check--fill ${workout2.done && !workoutRuleFail ? 'dash-check--on' : ''}`}
                      onClick={() => toggleBool('workout_2_done')}
                    >
                      <span className="dash-check-box" aria-hidden>{workout2.done ? '✓' : ''}</span>
                      <span className="dash-check-body">
                        <p className="dash-check-title">
                          Workout 2{' '}
                          {workout2.type ? (
                            <span className="dash-workout-type-badge">
                              {String(workout2.type).toUpperCase()}
                            </span>
                          ) : null}
                        </p>
                        <p
                          className={`dash-check-sub ${workout2.done && !workoutRuleFail ? 'dash-check-sub--good' : ''}`}
                        >
                          {workout2.done ? workout2.name || 'Logged ✓' : 'Tap › to log workout'}
                        </p>
                      </span>
                    </button>
                    <button type="button" className="dash-check-jump" onClick={() => setTab('workouts')}>
                      ›
                    </button>
                  </div>
                </>
              )}

              <div className={`dash-mission-card${displayLog.reading_done ? ' dash-mission-card--done' : ''}`}>
                <button
                  type="button"
                  className={`dash-check dash-check--fill ${displayLog.reading_done ? 'dash-check--on' : ''}`}
                  onClick={() => setReadingModalOpen(true)}
                >
                  <span
                    className="dash-check-box"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      void toggleBool('reading_done')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        void toggleBool('reading_done')
                      }
                    }}
                  >
                    {displayLog.reading_done ? '✓' : ''}
                  </span>
                  <span className="dash-check-body">
                    <p className="dash-check-title">Read 10 pages</p>
                    <p className={`dash-check-sub ${displayLog.reading_log ? 'dash-check-sub--good' : ''}`}>
                      {readingSubtitle}
                    </p>
                    {displayLog.reading_done && !displayLog.reading_log ? (
                      <p className="dash-check-sub dash-check-sub--warn">Don&apos;t forget to log your book</p>
                    ) : null}
                  </span>
                </button>
                <button type="button" className="dash-check-jump" onClick={() => setReadingModalOpen(true)}>›</button>
              </div>

              {!is75Soft(challengeType) ? (
                <div className={`dash-mission-card${displayLog.photo_done ? ' dash-mission-card--done' : ''}`}>
                  <button
                    type="button"
                    className={`dash-check dash-check--fill ${displayLog.photo_done ? 'dash-check--on' : ''}`}
                    onClick={() => toggleBool('photo_done')}
                  >
                    <span className="dash-check-box" aria-hidden>{displayLog.photo_done ? '✓' : ''}</span>
                    <span className="dash-check-body">
                      <p className="dash-check-title">Progress photo</p>
                      <p className={`dash-check-sub ${displayLog.progress_photo ? 'dash-check-sub--good' : 'dash-check-sub--warn'}`}>
                        {displayLog.progress_photo ? 'Photo uploaded ✓' : 'Tap › to upload in Progress'}
                      </p>
                    </span>
                  </button>
                  <button type="button" className="dash-check-jump" onClick={() => setTab('progress')}>
                    ›
                  </button>
                </div>
              ) : null}

              <div
                className={`dash-mission-card${
                  isWaterDone(displayLog, challengeType)
                    ? ' dash-mission-card--done'
                    : (displayLog.water_ml ?? 0) > 0
                      ? ' dash-mission-card--partial'
                      : ''
                }`}
              >
                <div className={`dash-check dash-check--fill ${isWaterDone(displayLog, challengeType) ? 'dash-check--on' : ''}`}>
                  <span className="dash-check-box" aria-hidden>
                    {isWaterDone(displayLog, challengeType) ? '✓' : ''}
                  </span>
                  <span className="dash-check-body">
                    <p className="dash-check-title">Water</p>
                    <p className="dash-check-sub">
                      {((displayLog.water_ml ?? 0) / 1000).toFixed(1)}L / {waterLitersLabel(challengeType)}L
                    </p>
                    <div className="dash-water-bar">
                      <div
                        className="dash-water-bar-fill"
                        style={{
                          width: `${Math.min(100, ((displayLog.water_ml ?? 0) / waterTarget) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="dash-check-sub dash-water-milestone">
                      {waterMilestoneMessage(displayLog.water_ml, challengeType)}
                    </p>
                    <div className="dash-water-btns">
                      <button type="button" onClick={() => subtractWater(250)}>
                        -250ml
                      </button>
                      <button type="button" onClick={() => subtractWater(100)}>
                        -100ml
                      </button>
                      <button type="button" onClick={() => addWater(100)}>
                        +100ml
                      </button>
                      <button type="button" onClick={() => addWater(250)}>
                        +250ml
                      </button>
                      <button type="button" onClick={() => addWater(500)}>
                        +500ml
                      </button>
                    </div>
                  </span>
                </div>
              </div>

              {is75Soft(challengeType) ? (
                <div
                  className={`dash-mission-card${
                    displayLog.is_recovery_day ? ' dash-mission-card--done' : ''
                  }`}
                >
                  <button
                    type="button"
                    className={`dash-check dash-check--fill ${displayLog.is_recovery_day ? 'dash-check--on' : ''}`}
                    disabled={
                      viewDate !== calendarToday ||
                      (recoveryWeekBlocked && !displayLog.is_recovery_day)
                    }
                    onClick={() => void toggleRecoveryDay()}
                  >
                    <span className="dash-check-box" aria-hidden>
                      {displayLog.is_recovery_day ? '🧘' : ''}
                    </span>
                    <span className="dash-check-body">
                      <p className="dash-check-title">
                        Recovery day? <span className="dash-inline-note">(1 allowed per week)</span>
                      </p>
                      {displayLog.is_recovery_day ? (
                        <p className="dash-check-sub dash-check-sub--good">
                          🧘 Rest and light movement today — workout logged automatically
                        </p>
                      ) : recoveryWeekBlocked ? (
                        <p className="dash-check-sub dash-check-sub--warn dash-check-sub--warn-muted">
                          Recovery day already used this week
                        </p>
                      ) : (
                        <p className="dash-check-sub">One gentle day per week — counts as your workout.</p>
                      )}
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
            {workoutRuleFail && !is75Soft(challengeType) ? (
              <div className="dash-workout-rule-warn">
                ⚠️ 75 Hard requires at least one outdoor workout.
              </div>
            ) : null}
          </>
        )}

        {tab === 'meals' && profile && (
          <>
            {showMealsBackCta ? (
              <button
                type="button"
                className="dash-back-to-today"
                onClick={() => {
                  setTab('today')
                  setShowMealsBackCta(false)
                }}
              >
                ← Back to Today
              </button>
            ) : null}
            <h1 className="dash-section-title">Meals</h1>
            <p className="dash-muted">Macro targets from your profile and a one-day planner.</p>

            {actualNutritionTracker ? (
              <section className="dash-meals-section" aria-labelledby="nutrition-tracker-heading">
                <div className="dash-nutrition-tracker-card">
                  <h2 id="nutrition-tracker-heading" className="dash-nutrition-tracker-title">
                    Today&apos;s Nutrition Tracker
                  </h2>
                  <p className="dash-nutrition-tracker-sub">Today&apos;s actual intake</p>
                  <div className="dash-nutrition-tracker-rows">
                    {actualNutritionTracker.rows.map((row) => (
                      <div key={row.key} className="dash-nutrition-tracker-row">
                        <div className="dash-nutrition-tracker-labels">
                          <span>{row.label}</span>
                          <span className="dash-nutrition-tracker-nums">
                            {Math.round(row.act)}
                            {row.tgt > 0 ? ` / ${Math.round(row.tgt)}` : ''}
                            {row.key === 'calories' ? ' kcal' : ' g'}
                          </span>
                        </div>
                        <div className="dash-nutrition-tracker-bar-wrap">
                          <div
                            className={`dash-nutrition-tracker-bar dash-nutrition-tracker-bar--${row.tone}`}
                            style={{ width: `${row.tgt > 0 ? Math.min(100, row.pct) : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="dash-nutrition-tracker-foot">
                    {actualNutritionTracker.loggedCount} of 5 meals logged today
                  </p>
                  {nutritionCompletionSummary ? (
                    <div
                      className={`dash-nutrition-complete${
                        nutritionCompletionSummary.tone === 'ok'
                          ? ' dash-nutrition-complete--ok'
                          : ' dash-nutrition-complete--warn'
                      }`}
                    >
                      {nutritionCompletionSummary.text}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="dash-meals-section">
              <div className="dash-meal-slot-status-wrap">
                {mealSlotStatus.map((slot) => (
                  <button
                    key={slot.slot}
                    type="button"
                    className="dash-meal-slot-status"
                    onClick={() =>
                      mealCardRefs.current[slot.idx]?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      })
                    }
                  >
                    <span
                      className={`dash-meal-slot-dot dash-meal-slot-dot--${slot.status}`}
                      aria-hidden
                    >
                      {slot.status === 'logged' ? '✓' : slot.status === 'bad' ? '✗' : ''}
                    </span>
                    <span>{MEAL_SLOT_LABELS[slot.idx]}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="dash-meals-section" aria-labelledby="meals-macros-heading">
              <h2 id="meals-macros-heading" className="dash-meals-section-title">
                Macro targets
              </h2>
              <div className="dash-meals-macro-grid">
                <div className="dash-meals-macro-card">
                  <p className="dash-meals-macro-label">Calories (kcal/day)</p>
                  <p className="dash-meals-macro-value">{macros.calories ?? '—'}</p>
                </div>
                <div className="dash-meals-macro-card">
                  <p className="dash-meals-macro-label">Protein (g)</p>
                  <p className="dash-meals-macro-value">{macros.protein ?? '—'}</p>
                </div>
                <div className="dash-meals-macro-card">
                  <p className="dash-meals-macro-label">Carbs (g)</p>
                  <p className="dash-meals-macro-value">{macros.carbs ?? '—'}</p>
                </div>
                <div className="dash-meals-macro-card">
                  <p className="dash-meals-macro-label">Fat (g)</p>
                  <p className="dash-meals-macro-value">{macros.fat ?? '—'}</p>
                </div>
                <div className="dash-meals-macro-card">
                  <p className="dash-meals-macro-label">Fiber (g)</p>
                  <p className="dash-meals-macro-value">{macros.fiber ?? '—'}</p>
                </div>
                <div className="dash-meals-macro-card">
                  <p className="dash-meals-macro-label">Water</p>
                  <p className="dash-meals-macro-value">3.7L</p>
                </div>
              </div>
            </section>

            <section className="dash-meals-section" aria-labelledby="meals-planner-heading">
              <div className="dash-meal-planner-card">
                <h2 id="meals-planner-heading" className="dash-meal-planner-title">
                  Today&apos;s Meal Plan
                </h2>
                <label className="dash-meal-planner-label" htmlFor="meal-plan-request">
                  Special requests
                </label>
                <textarea
                  id="meal-plan-request"
                  className="dash-meal-planner-textarea"
                  value={mealPlanRequest}
                  onChange={(e) => setMealPlanRequest(e.target.value)}
                  rows={3}
                  placeholder="Any special request? e.g. 'I have paneer today' or 'make it cooling for summer'"
                  disabled={mealPlanGenerating}
                />
                <button
                  type="button"
                  className="dash-meal-planner-generate dash-meal-planner-generate--primary"
                  onClick={() => void generateMealPlan()}
                  disabled={mealPlanGenerating}
                >
                  ✨ Generate Meal Plan
                </button>
                {mealPlanGenerating ? (
                  <p className="dash-meal-planner-loading" role="status" aria-live="polite">
                    <span className="dash-meal-planner-spin" aria-hidden>
                      🌀
                    </span>{' '}
                    Crafting your plan...
                  </p>
                ) : null}
                <div className="dash-meal-plan-result">
                  {mealPlanOutput.trim() && mealPlanSplit?.preamble?.length ? (
                    <div className="dash-meal-plan-preamble">{mealPlanSplit.preamble.join('\n')}</div>
                  ) : null}
                  {mealPlanOutput.trim() && mealPlanBadges.length ? (
                    <div className="dash-meal-badge-strip" role="list">
                      {mealPlanBadges.map((b, i) => (
                        <div
                          key={`${b.kind}-${i}-${b.text.slice(0, 24)}`}
                          role="listitem"
                          className={`dash-meal-badge dash-meal-badge--${b.kind}${
                            b.muted ? ' dash-meal-badge--muted' : ''
                          }`}
                        >
                          {b.text}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {mealSlotsSplit ? (
                      <div className="dash-meal-slots">
                        {mealSlotsSplit.segments.map((seg, slotIndex) => {
                          const joined = segmentJoinedText(seg).replace(/\n/g, ' ')
                          const { body, macros: mm } = stripMacroSuffix(joined)
                          const slotKey = MEAL_SLOT_ORDER[slotIndex]
                          const loggedEntry = loggedMealsBySlot.get(slotKey)
                          const isLogged = !!loggedEntry && activeLogEditSlot !== slotIndex
                          return (
                            <div
                              key={slotIndex}
                              className={`dash-meal-slot-card${isLogged ? ' dash-meal-slot-card--logged' : ''}`}
                              ref={(node) => {
                                mealCardRefs.current[slotIndex] = node
                              }}
                            >
                              <div className="dash-meal-slot-head">
                                <span className="dash-meal-slot-title">
                                  {MEAL_SLOT_LABELS[slotIndex]}
                                </span>
                                {isLogged ? (
                                  <span className="dash-meal-slot-logged-badge">LOGGED ✓</span>
                                ) : !structuredMealsOk ? null : (
                                  <button
                                    type="button"
                                    className="dash-meal-slot-refresh"
                                    onClick={() => void refreshMealSlot(slotIndex)}
                                    disabled={mealPlanGenerating || mealSlotLoading === slotIndex}
                                    aria-label={`Refresh ${MEAL_SLOT_LABELS[slotIndex]}`}
                                  >
                                    {mealSlotLoading === slotIndex ? (
                                      <span className="dash-meal-slot-spinner" aria-hidden />
                                    ) : (
                                      '↻'
                                    )}
                                  </button>
                                )}
                              </div>
                              {isLogged ? (
                                <>
                                  <ul className="dash-meal-logged-list">
                                    {loggedMealListLinesFromEntry(loggedEntry).map((x, i) => (
                                      <li key={`${slotKey}-${i}`}>{x}</li>
                                    ))}
                                  </ul>
                                  <div className="dash-meal-macro-pills">
                                    <span className="dash-meal-pill dash-meal-pill--p">
                                      P: {Math.round(Number(loggedEntry.protein_g) || 0)}g
                                    </span>
                                    <span className="dash-meal-pill dash-meal-pill--c">
                                      C: {Math.round(Number(loggedEntry.carbs_g) || 0)}g
                                    </span>
                                    <span className="dash-meal-pill dash-meal-pill--f">
                                      F: {Math.round(Number(loggedEntry.fat_g) || 0)}g
                                    </span>
                                    <span className="dash-meal-pill dash-meal-pill--k">
                                      ~{Math.round(Number(loggedEntry.calories) || 0)} kcal
                                    </span>
                                  </div>
                                  {loggedEntry.modified_from_suggestion ? (
                                    <p className="dash-meal-modified-tag">Modified from suggestion</p>
                                  ) : null}
                                  <p className="dash-meal-logged-time">
                                    Logged at {formatTimeHM(loggedEntry.logged_at)}
                                  </p>
                                  <button
                                    type="button"
                                    className="dash-meal-edit-link"
                                    onClick={() => {
                                      setActiveLogEditSlot(slotIndex)
                                      setMealElseSlots((prev) => {
                                        const n = [...prev]
                                        n[slotIndex] = {
                                          ...n[slotIndex],
                                          expanded: true,
                                          mode: loggedEntry.modified_from_suggestion
                                            ? 'edited'
                                            : 'custom',
                                          draft: loggedEntry.description ?? '',
                                          result: null,
                                          breakdown: null,
                                          modifiedFromSuggestion:
                                            !!loggedEntry.modified_from_suggestion,
                                        }
                                        return n
                                      })
                                    }}
                                  >
                                    Edit log
                                  </button>
                                </>
                              ) : (
                                <>
                                  {structuredMealsOk ? (
                                    <p className="dash-meal-slot-body">{body}</p>
                                  ) : null}
                                  {structuredMealsOk && mm ? (
                                    <div className="dash-meal-macro-pills">
                                      <span className="dash-meal-pill dash-meal-pill--p">
                                        P: {mm.p}g
                                      </span>
                                      <span className="dash-meal-pill dash-meal-pill--c">
                                        C: {mm.c}g
                                      </span>
                                      <span className="dash-meal-pill dash-meal-pill--f">
                                        F: {mm.f}g
                                      </span>
                                      <span className="dash-meal-pill dash-meal-pill--k">
                                        ~{mm.kcal} kcal
                                      </span>
                                    </div>
                                  ) : null}
                                  {!structuredMealsOk ? (
                                    <div className="dash-meal-actions-row dash-meal-actions-row--single">
                                      <button
                                        type="button"
                                        className="dash-meal-else-toggle"
                                        onClick={() => {
                                          setActiveLogEditSlot(null)
                                          setMealElseSlots((prev) => {
                                            const n = [...prev]
                                            n[slotIndex] = {
                                              ...n[slotIndex],
                                              expanded: !n[slotIndex].expanded,
                                              mode: 'custom',
                                              modifiedFromSuggestion: false,
                                              draft:
                                                n[slotIndex].mode === 'custom'
                                                  ? n[slotIndex].draft
                                                  : '',
                                              result: null,
                                              breakdown: null,
                                            }
                                            return n
                                          })
                                        }}
                                      >
                                        Add meal +
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="dash-meal-actions-row">
                                      <button
                                        type="button"
                                        className="dash-meal-edit-btn"
                                        onClick={() => {
                                          setActiveLogEditSlot(null)
                                          setMealElseSlots((prev) => {
                                            const n = [...prev]
                                            n[slotIndex] = {
                                              ...n[slotIndex],
                                              expanded: true,
                                              mode: 'edited',
                                              draft: body,
                                              result: null,
                                              breakdown: null,
                                              modifiedFromSuggestion: true,
                                            }
                                            return n
                                          })
                                        }}
                                      >
                                        Edit &amp; Log
                                      </button>
                                      <button
                                        type="button"
                                        className="dash-meal-else-toggle"
                                        onClick={() => {
                                          setActiveLogEditSlot(null)
                                          setMealElseSlots((prev) => {
                                            const n = [...prev]
                                            n[slotIndex] = {
                                              ...n[slotIndex],
                                              expanded: !n[slotIndex].expanded,
                                              mode: 'custom',
                                              modifiedFromSuggestion: false,
                                              draft:
                                                n[slotIndex].mode === 'custom'
                                                  ? n[slotIndex].draft
                                                  : '',
                                              result: null,
                                              breakdown: null,
                                            }
                                            return n
                                          })
                                        }}
                                      >
                                        I had something else
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                              {!isLogged && mealElseSlots[slotIndex]?.expanded ? (
                                <div className="dash-meal-else-panel">
                                  {!mealElseSlots[slotIndex]?.result ? (
                                    <>
                                      <label
                                        className="dash-meal-else-label"
                                        htmlFor={`meal-else-${slotIndex}`}
                                      >
                                        {mealElseSlots[slotIndex]?.mode === 'edited'
                                          ? 'Edit meal items'
                                          : 'What did you eat?'}
                                      </label>
                                      <textarea
                                        id={`meal-else-${slotIndex}`}
                                        className="dash-meal-else-input"
                                        rows={2}
                                        placeholder='e.g. "2 chapatis, sabzi, curd"'
                                        value={mealElseSlots[slotIndex]?.draft ?? ''}
                                        onChange={(e) =>
                                          setMealElseSlots((prev) => {
                                            const n = [...prev]
                                            n[slotIndex] = { ...n[slotIndex], draft: e.target.value }
                                            return n
                                          })
                                        }
                                        disabled={mealElseSlots[slotIndex]?.loading}
                                      />
                                      <button
                                        type="button"
                                        className="dash-meal-else-calc"
                                        onClick={() => void calculateActualMealForSlot(slotIndex)}
                                        disabled={
                                          mealElseSlots[slotIndex]?.loading ||
                                          !(mealElseSlots[slotIndex]?.draft ?? '').trim()
                                        }
                                      >
                                        {mealElseSlots[slotIndex]?.loading
                                          ? 'Analyzing…'
                                          : 'Calculate & Log'}
                                      </button>
                                    </>
                                  ) : (
                                    <div className="dash-meal-else-result">
                                      {Array.isArray(mealElseSlots[slotIndex].breakdown) &&
                                      mealElseSlots[slotIndex].breakdown.length ? (
                                        <div className="dash-meal-breakdown-wrap">
                                          <table className="dash-meal-breakdown-table">
                                            <thead>
                                              <tr>
                                                <th>Item</th>
                                                <th>Qty</th>
                                                <th>Calories</th>
                                                <th>Protein</th>
                                                <th>Carbs</th>
                                                <th>Fat</th>
                                                <th>Fiber</th>
                                                <th>Source</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {mealElseSlots[slotIndex].breakdown.map((row, bi) => (
                                                <tr key={`${slotIndex}-b-${bi}`}>
                                                  <td>{row.item}</td>
                                                  <td>{row.qty || '-'}</td>
                                                  <td>{Math.round(row.calories)}</td>
                                                  <td>{Math.round(row.protein_g)}g</td>
                                                  <td>{Math.round(row.carbs_g)}g</td>
                                                  <td>{Math.round(row.fat_g)}g</td>
                                                  <td>{Math.round(row.fiber_g)}g</td>
                                                  <td>{row.source || 'from api'}</td>
                                                </tr>
                                              ))}
                                              <tr className="dash-meal-breakdown-total">
                                                <td>Total</td>
                                                <td>-</td>
                                                <td>{Math.round(mealElseSlots[slotIndex].result.calories)}</td>
                                                <td>{Math.round(mealElseSlots[slotIndex].result.protein_g)}g</td>
                                                <td>{Math.round(mealElseSlots[slotIndex].result.carbs_g)}g</td>
                                                <td>{Math.round(mealElseSlots[slotIndex].result.fat_g)}g</td>
                                                <td>{Math.round(mealElseSlots[slotIndex].result.fiber_g)}g</td>
                                                <td>-</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                          {mealElseSlots[slotIndex].breakdown.some(
                                            (row) => row.source === 'estimated'
                                          ) ? (
                                            <p className="dash-meal-breakdown-note">
                                              Items marked &quot;estimated&quot; may be inaccurate. Edit quantities for
                                              better accuracy.
                                            </p>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <p className="dash-meal-breakdown-fallback">
                                          Item breakdown unavailable — showing total macros only.
                                        </p>
                                      )}
                                      <div className="dash-meal-macro-pills dash-meal-macro-pills--compact">
                                        <span className="dash-meal-pill dash-meal-pill--p">
                                          P: {mealElseSlots[slotIndex].result.protein_g}g
                                        </span>
                                        <span className="dash-meal-pill dash-meal-pill--c">
                                          C: {mealElseSlots[slotIndex].result.carbs_g}g
                                        </span>
                                        <span className="dash-meal-pill dash-meal-pill--f">
                                          F: {mealElseSlots[slotIndex].result.fat_g}g
                                        </span>
                                        <span className="dash-meal-pill dash-meal-pill--k">
                                          ~{mealElseSlots[slotIndex].result.calories} kcal
                                        </span>
                                        <span className="dash-meal-pill dash-meal-pill--fiber">
                                          Fiber: {mealElseSlots[slotIndex].result.fiber_g}g
                                        </span>
                                      </div>
                                      {mealElseSlots[slotIndex].result.is_clean_diet ? (
                                        <div className="dash-meal-clean-badge dash-meal-clean-badge--ok">
                                          ✓ Clean diet
                                        </div>
                                      ) : (
                                        <div className="dash-meal-clean-badge dash-meal-clean-badge--bad">
                                          ✗ Not clean diet
                                        </div>
                                      )}
                                      <p className="dash-meal-else-reason">
                                        {mealElseSlots[slotIndex].result.reason}
                                      </p>
                                      {mealElseSlots[slotIndex].result.is_clean_diet ? (
                                        <button
                                          type="button"
                                          className="dash-meal-else-log"
                                          onClick={() => void logActualMealForSlot(slotIndex)}
                                          disabled={mealElseSlots[slotIndex]?.logging || !todayLog?.id}
                                        >
                                          {mealElseSlots[slotIndex]?.logging
                                            ? 'Saving…'
                                            : 'Confirm & Log'}
                                        </button>
                                      ) : is75Soft(challengeType) ? (
                                        <div className="dash-meal-dirty-wrap">
                                          <div className="dash-meal-dirty-alert dash-meal-dirty-alert--soft" role="alert">
                                            <p className="dash-meal-dirty-title">
                                              ⚠️ That&apos;s not the cleanest choice — but one slip doesn&apos;t end
                                              your journey. Keep going 💪
                                            </p>
                                          </div>
                                          <div className="dash-meal-dirty-actions">
                                            <button
                                              type="button"
                                              className="dash-meal-dirty-dismiss"
                                              onClick={() => dismissDirtyMealSlot(slotIndex)}
                                            >
                                              Don&apos;t log this meal
                                            </button>
                                            <button
                                              type="button"
                                              className="dash-meal-else-log"
                                              onClick={() => void logActualMealForSlot(slotIndex)}
                                              disabled={mealElseSlots[slotIndex]?.logging || !todayLog?.id}
                                            >
                                              {mealElseSlots[slotIndex]?.logging ? 'Saving…' : 'Log anyway'}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="dash-meal-dirty-wrap">
                                          <div className="dash-meal-dirty-alert" role="alert">
                                            <p className="dash-meal-dirty-title">
                                              ⚠️ That&apos;s not a clean diet meal.
                                              {mealElseSlots[slotIndex].result.violation
                                                ? ` “${mealElseSlots[slotIndex].result.violation}” is not allowed on 75 Hard.`
                                                : ' This meal is not allowed on 75 Hard.'}
                                            </p>
                                            <p className="dash-meal-dirty-rule">
                                              According to 75 Hard rules, consuming a non-clean meal means you
                                              must restart your challenge.
                                            </p>
                                          </div>
                                          <div className="dash-meal-dirty-actions">
                                            <button
                                              type="button"
                                              className="dash-meal-dirty-dismiss"
                                              onClick={() => dismissDirtyMealSlot(slotIndex)}
                                            >
                                              I made a mistake — don&apos;t log this
                                            </button>
                                            <button
                                              type="button"
                                              className="dash-meal-dirty-restart"
                                              onClick={() => void restartChallengeFromMeals()}
                                              disabled={mealElseRestartBusy}
                                            >
                                              {mealElseRestartBusy ? 'Working…' : 'Restart Challenge'}
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                    {mealPlanOutput.trim() && !structuredMealsOk ? (
                      <div className="dash-meal-plan-lines dash-meal-plan-lines--legacy">
                        {mealPlanOutput
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .map((t, idx, rows) => (
                            <div
                              key={`${idx}-${t.slice(0, 32)}`}
                              className={`dash-meal-plan-line${
                                idx === rows.length - 1 ? ' dash-meal-plan-line--last' : ''
                              }`}
                            >
                              {t}
                            </div>
                          ))}
                      </div>
                    ) : null}
                    {mealPlanOutput.trim() ? (
                      <button
                        type="button"
                        className="dash-meal-planner-save"
                        onClick={() => void saveMealPlanToLog()}
                        disabled={mealPlanSaveBusy || !todayLog?.id}
                      >
                        {mealPlanSaveBusy ? 'Saving…' : 'Save to today’s log'}
                      </button>
                    ) : null}
                  </div>
              </div>
            </section>

            <section className="dash-meals-section">
              <button
                type="button"
                className="dash-micron-collapse-trigger"
                aria-expanded={mealsMicronOpen}
                onClick={() => setMealsMicronOpen((o) => !o)}
              >
                <span>Micronutrient Guide</span>
                <span className="dash-micron-collapse-chevron" aria-hidden>
                  {mealsMicronOpen ? '▾' : '▸'}
                </span>
              </button>
              {mealsMicronOpen ? (
                <div className="dash-micron-collapse-panel">
                  {MEALS_MICRONUTRIENTS.map((m) => (
                    <div key={m.name} className="dash-micron-meal-row">
                      <span
                        className="dash-micron-dot"
                        style={{ background: m.dot }}
                        aria-hidden
                      />
                      <div className="dash-micron-meal-body">
                        <p className="dash-micron-meal-title">
                          {m.name}{' '}
                          <span className="dash-micron-meal-target">({m.target})</span>
                        </p>
                        <p className="dash-micron-meal-sources">{m.sources}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </>
        )}

        {tab === 'workouts' && (
          <>
            {showWorkoutsBackCta ? (
              <button
                type="button"
                className="dash-back-to-today"
                onClick={() => {
                  setTab('today')
                  setShowWorkoutsBackCta(false)
                }}
              >
                ← Back to Today
              </button>
            ) : null}
            {is75Soft(challengeType) ? (
              <div className="dash-workout-recovery-top">
                <button
                  type="button"
                  className="dash-btn-secondary"
                  disabled={
                    viewDate !== calendarToday ||
                    (recoveryWeekBlocked && !displayLog.is_recovery_day)
                  }
                  onClick={() => void toggleRecoveryDay()}
                >
                  Mark as Recovery Day
                </button>
                {recoveryWeekBlocked && !displayLog.is_recovery_day ? (
                  <p className="dash-muted dash-workout-recovery-hint">Recovery day already used this week</p>
                ) : null}
              </div>
            ) : null}
            <div ref={workoutsScrollTopRef}>
              <h1 className="dash-section-title">Workouts</h1>
              <p className="dash-muted">Pick, log, or replace each slot.</p>

              <div className="dash-workout-slots">
                {(is75Soft(challengeType)
                  ? [{ slot: 1, data: workout1 }]
                  : [{ slot: 1, data: workout1 }, { slot: 2, data: workout2 }]
                ).map(({ slot, data }) => (
                  <div key={slot} className="dash-workout-slot-card">
                    <div className="dash-workout-slot-head">
                      <p className="dash-workout-slot-title">
                        {is75Soft(challengeType) ? 'WORKOUT' : `WORKOUT ${slot}`}
                      </p>
                      {data.done ? <span className="dash-meal-slot-logged-badge">LOGGED ✓</span> : null}
                    </div>
                    {data.done ? (
                      <>
                        <p className="dash-workout-slot-name">
                          {data.name ||
                            (is75Soft(challengeType) ? 'Your workout · 45 min' : `Workout ${slot}`)}
                        </p>
                        {!is75Soft(challengeType) ? (
                          <span
                            className={`dash-workout-slot-location${
                              (data.type || 'indoor') === 'outdoor'
                                ? ' dash-workout-slot-location--outdoor'
                                : ''
                            }`}
                          >
                            {(data.type || 'indoor').toUpperCase()}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="dash-meal-edit-link"
                          onClick={() => beginAssignWorkout(slot)}
                        >
                          Change
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="dash-workout-slot-name">
                          {is75Soft(challengeType) ? 'Workout · 45 min (any)' : `Workout ${slot}`}
                        </p>
                        {!is75Soft(challengeType) ? (
                          <span className="dash-workout-slot-location">INDOOR/OUTDOOR</span>
                        ) : null}
                        <div className="dash-workout-slot-btns">
                          <button
                            type="button"
                            className="dash-btn-secondary"
                            onClick={() => beginAssignWorkout(slot)}
                          >
                            Browse &amp; Pick
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {workoutInlineMsg ? <p className="dash-check-sub dash-check-sub--good">{workoutInlineMsg}</p> : null}
            {!is75Soft(challengeType) &&
            workout1.done &&
            workout2.done &&
            (workout1.type || 'indoor') === 'indoor' &&
            (workout2.type || 'indoor') === 'indoor' ? (
              <div className="dash-workout-rule-warn">⚠️ At least one must be outdoor</div>
            ) : null}

            <div className="dash-workout-pref">
              <div className="dash-workout-chip-row" style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
                {WORKOUT_PREF_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className={workoutPrefChips[0] === chip ? 'dash-workout-chip dash-workout-chip--on' : 'dash-workout-chip'}
                    onClick={() => setWorkoutPrefChips([chip])}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className="dash-workout-notes"
                placeholder="Notes (e.g. legs are sore today)"
                value={workoutPrefNotes}
                onChange={(e) => setWorkoutPrefNotes(e.target.value)}
              />
            </div>

            <div ref={workoutListAnchorRef}>
              {assigningSlot ? (
                <div className="dash-workout-assign-banner" role="status">
                  {is75Soft(challengeType)
                    ? 'Selecting your workout — tap one below'
                    : `Selecting for Workout ${assigningSlot} — tap a workout below`}
                </div>
              ) : null}
              <div className="dash-work-list">
                {(filteredWorkouts || []).map((w) => (
                  <div key={`${w.location}-${w.name}`} className="dash-work-card">
                    <div className="dash-work-head">
                      <p className="dash-work-name">{w.name}</p>
                      <span className={typeBadgeClass(w.type)}>{w.type.toUpperCase()}</span>
                    </div>
                    <p
                      className={`dash-workout-slot-location dash-workout-slot-location--inline${
                        w.location === 'outdoor' ? ' dash-workout-slot-location--outdoor' : ''
                      }`}
                    >
                      {w.location.toUpperCase()}
                    </p>
                    <p className="dash-work-desc">{w.desc}</p>
                    <div className="dash-workout-slot-btns">
                      {assigningSlot === 1 ? (
                        <button
                          type="button"
                          className="dash-btn-secondary"
                          onClick={() => void logWorkoutToSlot(1, w.name, w.location, { fromAssignMode: true })}
                        >
                          {workout1.done ? 'Replace Workout 1' : 'Select for Workout 1'}
                        </button>
                      ) : null}
                      {!is75Soft(challengeType) && assigningSlot === 2 ? (
                        <button
                          type="button"
                          className="dash-btn-secondary"
                          onClick={() => void logWorkoutToSlot(2, w.name, w.location, { fromAssignMode: true })}
                        >
                          {workout2.done ? 'Replace Workout 2' : 'Select for Workout 2'}
                        </button>
                      ) : null}
                      {assigningSlot === null ? (
                        <>
                          <button
                            type="button"
                            className="dash-btn-secondary"
                            onClick={() => void logWorkoutToSlot(1, w.name, w.location)}
                          >
                            {workout1.done
                              ? is75Soft(challengeType)
                                ? 'Replace workout'
                                : 'Replace Workout 1'
                              : is75Soft(challengeType)
                                ? 'Log workout'
                                : 'Log as Workout 1'}
                          </button>
                          {!is75Soft(challengeType) ? (
                            <button
                              type="button"
                              className="dash-btn-secondary"
                              onClick={() => void logWorkoutToSlot(2, w.name, w.location)}
                            >
                              {workout2.done ? 'Replace Workout 2' : 'Log as Workout 2'}
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'progress' && profile && (
          <>
            <h1 className="dash-section-title">Progress</h1>
            <p className="dash-muted">Your 75-day snapshot.</p>
            {showSoft75CompleteBanner ? (
              <div className="dash-soft-celebrate" role="status">
                <p className="dash-soft-celebrate-text">
                  🎉 You completed 75 Soft! You built the habit. Ready for the real test?
                </p>
                <button
                  type="button"
                  className="dash-soft-celebrate-btn"
                  disabled={challengeSwitchBusy}
                  onClick={() => void handleUpgradeTo75HardFromSoftBanner()}
                >
                  {challengeSwitchBusy ? 'Working…' : 'Start 75 Hard →'}
                </button>
              </div>
            ) : null}
            {!is75Soft(challengeType) ? (
              <div className="dash-photo-upload-row dash-photo-upload-row--below" style={{ marginBottom: '0.9rem' }}>
                <input
                  ref={progressPhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="dash-photo-file-input"
                  onChange={(e) => void onProgressPhotoFile(e)}
                />
                <button
                  type="button"
                  className="dash-photo-upload-btn"
                  disabled={progressPhotoBusy}
                  onClick={() => progressPhotoInputRef.current?.click()}
                >
                  {progressPhotoBusy ? 'Processing…' : 'Upload today’s progress photo'}
                </button>
              </div>
            ) : (
              <p className="dash-muted" style={{ marginBottom: '0.85rem' }}>
                Progress photos are optional on 75 Soft. You can upload one anytime from the Today tab.
              </p>
            )}

            <div className="dash-attempts-bar">
              <label className="dash-attempts-label" htmlFor="attempt-select">
                Previous attempts
              </label>
              <select
                id="attempt-select"
                className="dash-attempts-select"
                value={progressAttemptId ?? ''}
                onChange={(e) =>
                  setProgressAttemptId(e.target.value ? e.target.value : null)
                }
              >
                <option value="">Current attempt</option>
                {endedAttemptsSorted.map((a) => (
                  <option key={a.id} value={a.id}>
                    Attempt #{a.attempt_number} · {a.start_date} → {a.ended_at}
                  </option>
                ))}
              </select>
            </div>

            {progressMeta?.kind === 'active' ? (
              <div className="dash-progress-meta">
                <p className="dash-progress-meta-line">
                  <strong>Attempt #{progressMeta.attemptNum}</strong>
                </p>
                <p className="dash-progress-meta-line">
                  Started {formatLongDate(progressMeta.start)}
                </p>
                <p className="dash-progress-meta-line">
                  Days completed (all{' '}
                  {is75Soft(challengeType) ? 5 : 6}
                  ): {progressMeta.daysCompleted}
                </p>
              </div>
            ) : null}
            {progressMeta?.kind === 'past' ? (
              <p className="dash-progress-attempt-label">
                Attempt #{progressMeta.attemptNum} — started {formatLongDate(progressMeta.start)},
                ended {formatLongDate(progressMeta.ended)}
              </p>
            ) : null}

            <div className="dash-stat-grid dash-stat-grid--three">
              <div className="dash-stat">
                <p className="dash-stat-value">{progressStats.currentDay}</p>
                <p className="dash-stat-label">Current day</p>
              </div>
              <div className="dash-stat">
                <p className="dash-stat-value">{progressStats.daysLeft}</p>
                <p className="dash-stat-label">Days left</p>
              </div>
              <div className="dash-stat">
                <p className="dash-stat-value">#{progressStats.attemptNum}</p>
                <p className="dash-stat-label">Attempt</p>
              </div>
            </div>

            <h3 className="dash-section-title" style={{ fontSize: '1rem' }}>
              75-day grid
            </h3>
            <p className="dash-muted" style={{ marginTop: '-0.5rem' }}>
              {is75Soft(challengeType)
                ? isProgressHistoryView
                  ? 'Past attempt: green = full day · yellow = partial · gray = no log / future · orange outline = that day'
                  : 'Green = all tasks done · yellow = partial progress · gray = no log yet · orange outline = today'
                : isProgressHistoryView
                  ? 'Past attempt (read-only): green = all 6 tasks done · red = missed · dark gray = future days in this window · orange outline = that calendar day'
                  : 'Green = all 6 tasks done · red = incomplete (day has passed) · dark gray = future days · orange outline = today'}
            </p>
            <div
              className={`dash-grid-75${isProgressHistoryView ? ' dash-grid-75--readonly' : ''}`}
            >
              {progressGridDays.map(({ key, log, isToday, gridKind, hasPhoto }) => {
                let cls = 'dash-grid-cell'
                if (gridKind === 'future') cls += ' dash-grid-cell--future'
                else if (gridKind === 'perfect') cls += ' dash-grid-cell--perfect'
                else if (gridKind === 'partial') cls += ' dash-grid-cell--partial'
                else if (gridKind === 'empty') cls += ' dash-grid-cell--empty'
                else cls += ' dash-grid-cell--failed'
                if (isToday) cls += ' dash-grid-cell--today'
                if (hasPhoto) cls += ' dash-grid-cell--has-photo'
                return (
                  <button
                    key={key}
                    type="button"
                    className={cls}
                    onClick={() => setSelectedProgressDate(key)}
                    title={`${key}${gridKind === 'future' ? ' — future' : log ? '' : ' — no log'}${hasPhoto ? ' · photo' : ''}`}
                  >
                    {hasPhoto ? <span className="dash-grid-photo-dot" aria-hidden /> : null}
                  </button>
                )
              })}
            </div>
            {selectedProgressDate ? (
              <div className="dash-day-notes-panel">
                <p className="dash-day-notes-title">Day notes · {selectedProgressDate}</p>
                <p className="dash-day-notes-body">
                  {(logsByDate.get(selectedProgressDate)?.notes || '').trim() ||
                    'No notes logged for this day.'}
                </p>
              </div>
            ) : null}

            <h3 className="dash-section-title" style={{ fontSize: '1rem' }}>
              Progress photos
            </h3>
            {progressPhotosGallery.length >= 2 ? (
              <button
                type="button"
                className="dash-flipbook-open-btn"
                onClick={() => {
                  setFlipIndex(0)
                  setFlipPlaying(true)
                  setFlipbookOpen(true)
                }}
              >
                ▶ Create Flipbook
              </button>
            ) : null}
            {progressPhotosGallery.length ? (
              <div className="dash-photo-gallery">
                {progressPhotosGallery.map((p) => (
                  <div key={p.id} className="dash-photo-gallery-cell">
                    <img className="dash-photo-gallery-img" src={p.src} alt="" />
                    <p className="dash-photo-gallery-caption">
                      Day {p.dayNum} · {p.date}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dash-muted dash-photo-gallery-empty">
                Your transformation gallery will appear here as you upload daily photos.
              </p>
            )}

            <h3 className="dash-section-title" style={{ fontSize: '1rem' }}>
              Last 7 days
            </h3>
            <div className="dash-recent">
              {progressRecent7.map(({ key, log }) => (
                <div key={key} className="dash-recent-row">
                  <p className="dash-recent-date">
                    {key}
                    {key === todayLocalISO() ? ' · Today' : ''}
                  </p>
                  <p className="dash-recent-tasks">
                    {taskBreakdownLine(log, challengeType)}
                    {log?.reading_log?.book_title
                      ? ` · 📖 ${String(log.reading_log.book_title).trim()}`
                      : ''}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'profile' && profile && (
          <>
            <h1 className="dash-section-title">Profile</h1>
            <p className="dash-muted">Your account and challenge.</p>
            <div className="dash-profile-card">
              <div className="dash-profile-row">
                <span className="dash-profile-label">Username</span>
                <span className="dash-profile-value">{profile.username ?? '—'}</span>
              </div>
              <div className="dash-profile-row">
                <span className="dash-profile-label">Current Challenge</span>
                <span className="dash-profile-value">
                  {is75Soft(challengeType) ? (
                    <span className="dash-challenge-badge dash-challenge-badge--soft">75 SOFT</span>
                  ) : (
                    <span className="dash-challenge-badge dash-challenge-badge--hard">75 HARD</span>
                  )}
                </span>
              </div>
              <div className="dash-profile-row">
                <span className="dash-profile-label">Start date</span>
                <span className="dash-profile-value">{profile.start_date ?? '—'}</span>
              </div>
              <button
                type="button"
                className="dash-profile-switch-link"
                onClick={() => setChallengeSwitchOpen(true)}
              >
                Switch Challenge
              </button>
            </div>
          </>
        )}
      </main>

      {challengeSwitchOpen ? (
        <div
          className="dash-restart-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="switch-challenge-title"
        >
          <div className="dash-restart-panel">
            <h2 id="switch-challenge-title" className="dash-restart-title">
              Switch challenge?
            </h2>
            <p className="dash-restart-body">
              Switching will keep your data but reset your challenge. Are you sure?
            </p>
            <div className="dash-restart-actions-row">
              <button
                type="button"
                className="dash-meal-dirty-dismiss"
                onClick={() => setChallengeSwitchOpen(false)}
                disabled={challengeSwitchBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dash-restart-cta"
                onClick={() => void confirmSwitchChallenge()}
                disabled={challengeSwitchBusy}
              >
                {challengeSwitchBusy ? 'Working…' : 'Yes, reset & switch'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {readingModalOpen ? (
        <>
          <div className="dash-sheet-overlay" onClick={() => setReadingModalOpen(false)} />
          <div
            className="dash-reading-sheet-wrap"
            role="dialog"
            aria-modal="true"
            aria-label="Reading log"
          >
            <div className="dash-reading-sheet">
              <button
                type="button"
                className="dash-reading-sheet-close"
                onClick={() => setReadingModalOpen(false)}
              >
                ✕
              </button>
              <h3 className="dash-reading-sheet-title">Reading Log</h3>
              <label className="dash-reading-label" htmlFor="reading-book-choice">
                Choose book
              </label>
              <select
                id="reading-book-choice"
                className="dash-reading-input"
                value={readingAddNewBook ? '__new__' : readingBookChoice}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '__new__') {
                    setReadingAddNewBook(true)
                    setReadingBookChoice('')
                  } else {
                    setReadingAddNewBook(false)
                    setReadingBookChoice(v)
                  }
                }}
              >
                <option value="">Select a book</option>
                {(readingBooks || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.total_pages} pages)
                  </option>
                ))}
                <option value="__new__">+ Add new book</option>
              </select>
              {readingAddNewBook ? (
                <>
                  <label className="dash-reading-label" htmlFor="reading-new-title">
                    Book title
                  </label>
                  <input
                    id="reading-new-title"
                    type="text"
                    className="dash-reading-input"
                    value={readingNewBookTitle}
                    onChange={(e) => setReadingNewBookTitle(e.target.value)}
                  />
                  <label className="dash-reading-label" htmlFor="reading-new-total">
                    Total pages
                  </label>
                  <input
                    id="reading-new-total"
                    type="number"
                    min={1}
                    className="dash-reading-input"
                    value={readingNewBookTotalPages}
                    onChange={(e) => setReadingNewBookTotalPages(e.target.value)}
                  />
                </>
              ) : (
                <>
                  <label className="dash-reading-label" htmlFor="reading-start-page">
                    Started at page
                  </label>
                  <input
                    id="reading-start-page"
                    type="number"
                    min={1}
                    className="dash-reading-input"
                    value={readingSessionStartPage}
                    onChange={(e) => setReadingSessionStartPage(e.target.value)}
                  />
                  <label className="dash-reading-label" htmlFor="reading-end-page">
                    Finished at page
                  </label>
                  <input
                    id="reading-end-page"
                    type="number"
                    min={1}
                    className="dash-reading-input"
                    value={readingSessionEndPage}
                    onChange={(e) => setReadingSessionEndPage(e.target.value)}
                  />
                  {(() => {
                    const start = Number(readingSessionStartPage)
                    const end = Number(readingSessionEndPage)
                    const pages = Number.isFinite(start) && Number.isFinite(end) ? end - start + 1 : 0
                    const total = Number(selectedReadingBook?.total_pages || 0)
                    const pct = total > 0 ? Math.min(100, (Math.max(end, 0) / total) * 100) : 0
                    const msg =
                      pct >= 100
                        ? 'Book complete! 🎉 Log a new one tomorrow'
                        : pct >= 90
                          ? "Final stretch! You're about to finish a whole book 🏆"
                          : pct >= 75
                            ? 'Almost there! The ending is worth it'
                            : pct >= 50
                              ? "Past halfway — you're in the thick of it 🔥"
                              : pct >= 25
                                ? "You're building momentum! Keep going"
                                : 'Just getting started — the best is ahead 📖'
                    return (
                      <>
                        <p className="dash-check-sub">Pages today: {Math.max(0, pages)}</p>
                        <div className="dash-water-bar">
                          <div className="dash-water-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="dash-check-sub">{msg}</p>
                      </>
                    )
                  })()}
                </>
              )}
              <button
                type="button"
                className="dash-reading-save"
                disabled={readingSaveBusy}
                onClick={async () => {
                  const ok = await saveReadingLog(true)
                  if (ok) setReadingModalOpen(false)
                }}
              >
                {readingSaveBusy ? 'Saving…' : 'Save & Mark Done'}
              </button>
              <button
                type="button"
                className="dash-reading-skip"
                onClick={async () => {
                  await toggleBool('reading_done')
                  setReadingModalOpen(false)
                }}
              >
                Mark done without logging
              </button>
            </div>
          </div>
        </>
      ) : null}

      {flipbookOpen && progressPhotosFlipOrder.length ? (
        <div className="dash-flipbook-overlay" role="dialog" aria-modal="true" aria-label="Progress flipbook">
          <div className="dash-flipbook-inner">
            <button
              type="button"
              className="dash-flipbook-close"
              onClick={() => {
                setFlipbookOpen(false)
                setFlipGifMessage('')
              }}
            >
              ✕ Close
            </button>
            <div className="dash-flipbook-stage">
              <img
                className="dash-flipbook-img"
                src={progressPhotosFlipOrder[flipIndex % progressPhotosFlipOrder.length]?.src}
                alt=""
              />
              <div className="dash-flipbook-caption">
                Day {progressPhotosFlipOrder[flipIndex % progressPhotosFlipOrder.length]?.dayNum} ·{' '}
                {progressPhotosFlipOrder[flipIndex % progressPhotosFlipOrder.length]?.date}
              </div>
            </div>
            <div className="dash-flipbook-progress">
              <div
                className="dash-flipbook-progress-fill"
                style={{
                  width: `${((flipIndex % progressPhotosFlipOrder.length) + 1) / progressPhotosFlipOrder.length * 100}%`,
                }}
              />
            </div>
            <div className="dash-flipbook-controls">
              <button
                type="button"
                className="dash-flipbook-ctrl"
                onClick={() =>
                  setFlipIndex((i) => {
                    const n = progressPhotosFlipOrder.length
                    return (i - 1 + n) % n
                  })
                }
              >
                ◀ Prev
              </button>
              <button
                type="button"
                className="dash-flipbook-ctrl"
                onClick={() => setFlipPlaying((p) => !p)}
              >
                {flipPlaying ? '⏸ Pause' : '▶▶ Play'}
              </button>
              <button
                type="button"
                className="dash-flipbook-ctrl"
                onClick={() =>
                  setFlipIndex((i) => {
                    const n = progressPhotosFlipOrder.length
                    return (i + 1) % n
                  })
                }
              >
                Next ▶
              </button>
              <label className="dash-flipbook-speed-label">
                Speed
                <select
                  className="dash-flipbook-speed"
                  value={String(flipIntervalMs)}
                  onChange={(e) => setFlipIntervalMs(Number(e.target.value))}
                >
                  <option value="500">0.5s</option>
                  <option value="800">0.8s</option>
                  <option value="1500">1.5s</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              className="dash-flipbook-download"
              disabled={flipGifBusy || progressPhotosFlipOrder.length < 2}
              onClick={() => downloadFlipbookGif()}
            >
              {flipGifBusy ? 'Working…' : '⬇ Download as GIF'}
            </button>
            {flipGifMessage ? <p className="dash-flipbook-gif-msg">{flipGifMessage}</p> : null}
          </div>
        </div>
      ) : null}

      {restartFailureModal && !is75Soft(challengeType) ? (
        <div
          className="dash-restart-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="restart-title"
          aria-describedby="restart-desc"
        >
          <div className="dash-restart-panel">
            <h2 id="restart-title" className="dash-restart-title">
              Restart required
            </h2>
            <p id="restart-desc" className="dash-restart-body">
              You missed a requirement on {formatLongDate(restartFailureModal.missedDate)}.
              According to 75 Hard rules, you must restart.
            </p>
            <div className="dash-restart-block">
              <p className="dash-restart-sub">What was missed</p>
              <ul className="dash-restart-list">
                {restartFailureModal.missedLabels.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            {restartFailureModal.prevStats ? (
              <div className="dash-restart-block">
                <p className="dash-restart-sub">
                  Your stats from Attempt #{restartFailureModal.prevAttemptNumber} (before restart)
                </p>
                <ul className="dash-restart-list">
                  <li>Day reached: {restartFailureModal.prevStats.dayReached} of 75</li>
                  <li>Days fully completed: {restartFailureModal.prevStats.perfectDays}</li>
                </ul>
              </div>
            ) : null}
            <button
              type="button"
              className="dash-restart-cta"
              onClick={performRestartAttempt}
              disabled={restartBusy}
            >
              {restartBusy ? 'Working…' : `Start Attempt #${restartFailureModal.nextAttemptNum}`}
            </button>
          </div>
        </div>
      ) : null}

      <nav className="dash-nav" aria-label="Main">
        {[
          { id: 'today', label: 'Today', icon: '◎' },
          { id: 'meals', label: 'Meals', icon: '◆' },
          { id: 'workouts', label: 'Workouts', icon: '◇' },
          { id: 'progress', label: 'Progress', icon: '▦' },
          { id: 'profile', label: 'Profile', icon: '○' },
        ].map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'dash-nav--active' : ''}
            onClick={() => setTab(id)}
          >
            <span className="dash-nav-icon" aria-hidden>
              {icon}
            </span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
