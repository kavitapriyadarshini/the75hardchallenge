import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MACRO_CALC } from '../lib/constants'
import {
  CHALLENGE_75_HARD,
  CHALLENGE_75_SOFT,
  normalizeChallengeType,
  is75Soft,
} from '../lib/challenge'
import './onboarding.css'

const DIET_OPTIONS = [
  'North Indian (Roti, Dal, Sabzi, Paneer)',
  'South Indian (Rice, Sambar, Dosa, Idli)',
  'Indian Fusion (Mix of North + South)',
  'Mediterranean (Olive oil, Legumes, Fish, Veggies)',
  'High Protein Indian (Eggs, Paneer, Dal, Sprouts)',
  'Vegetarian Indian',
  'Vegan Indian',
  'General Healthy (Balanced, no restriction)',
]

const RESTRICTION_OPTIONS = [
  'No dairy',
  'No gluten',
  'Vegetarian',
  'Vegan',
  'No nuts',
  'No chicken',
]

// NEW
const FITNESS_INTEREST_OPTIONS = [
  'Running',
  'Hyrox',
  'Ironman / Triathlon',
  'Marathon',
  'Trekking / Hiking',
  'Strength training',
  'Cycling',
  'Swimming',
  'Yoga / Mobility',
  'Combat sports',
  'CrossFit',
  'General fitness',
]

function todayLocalISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function computeMacros(weightKg, heightCm, gender, age, challengeType) {
  const g = String(gender).toLowerCase()
  if (g === 'other') {
    const a = MACRO_CALC(weightKg, heightCm, 'male', age, challengeType)
    const b = MACRO_CALC(weightKg, heightCm, 'female', age, challengeType)
    return {
      calories: Math.round((a.calories + b.calories) / 2),
      protein: Math.round((a.protein + b.protein) / 2),
      carbs: Math.round((a.carbs + b.carbs) / 2),
      fat: Math.round((a.fat + b.fat) / 2),
      fiber: Math.round((a.fiber + b.fiber) / 2),
    }
  }
  return MACRO_CALC(weightKg, heightCm, gender, age, challengeType)
}

function parseMetricBody(
  unitSystem,
  weightMetric,
  weightImperial,
  heightCmInput,
  heightFt,
  heightIn
) {
  if (unitSystem === 'metric') {
    const w = parseFloat(String(weightMetric).replace(',', '.'))
    const h = parseFloat(String(heightCmInput).replace(',', '.'))
    return { weightKg: w, heightCm: h }
  }
  const wLb = parseFloat(String(weightImperial).replace(',', '.'))
  const ft = parseFloat(String(heightFt).replace(',', '.')) || 0
  const inch = parseFloat(String(heightIn).replace(',', '.')) || 0
  const weightKg = wLb * 0.453592
  const heightCmTotal = ft * 30.48 + inch * 2.54
  return { weightKg, heightCm: heightCmTotal }
}

export default function Onboarding() {
  const navigate = useNavigate()
  const location = useLocation()
  const challengeType = useMemo(
    () => normalizeChallengeType(location.state?.challengeType ?? CHALLENGE_75_HARD),
    [location.state?.challengeType]
  )

  const [authReady, setAuthReady] = useState(false)
  const [user, setUser] = useState(null)

  const [step, setStep] = useState(1)
  const [startDate, setStartDate] = useState(todayLocalISO)
  const [gender, setGender] = useState('female')
  const [dietType, setDietType] = useState('')
  const [restrictions, setRestrictions] = useState([])
  const [unitSystem, setUnitSystem] = useState('metric')
  const [weightMetric, setWeightMetric] = useState('')
  const [weightImperial, setWeightImperial] = useState('')
  const [heightCmField, setHeightCmField] = useState('')
  const [heightFt, setHeightFt] = useState('')
  const [heightIn, setHeightIn] = useState('')
  const [ageField, setAgeField] = useState('')

  // NEW
  const [fitnessInterests, setFitnessInterests] = useState([])
  const [city, setCity] = useState('')

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (cancelled) return
      if (!data.user) {
        navigate('/', { replace: true })
        return
      }
      setUser(data.user)
      setAuthReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  const username = useMemo(() => {
    const meta = user?.user_metadata
    if (meta?.display_name && String(meta.display_name).trim()) {
      return String(meta.display_name).trim()
    }
    const email = user?.email
    if (email && email.includes('@')) return email.split('@')[0]
    return 'User'
  }, [user])

  const { weightKg, heightCm } = useMemo(
    () =>
      parseMetricBody(
        unitSystem,
        weightMetric,
        weightImperial,
        heightCmField,
        heightFt,
        heightIn
      ),
    [
      unitSystem,
      weightMetric,
      weightImperial,
      heightCmField,
      heightFt,
      heightIn,
    ]
  )

  const macroPreview = useMemo(() => {
    const age = Number(ageField)
    if (
      !Number.isFinite(weightKg) ||
      !Number.isFinite(heightCm) ||
      !Number.isFinite(age) ||
      weightKg <= 0 ||
      heightCm <= 0 ||
      age < 16 ||
      age > 80
    ) {
      return null
    }
    return computeMacros(weightKg, heightCm, gender, age, challengeType)
  }, [weightKg, heightCm, gender, ageField, challengeType])

  const toggleRestriction = useCallback((label) => {
    setRestrictions((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    )
  }, [])

  // NEW
  const toggleFitnessInterest = useCallback((label) => {
    setFitnessInterests((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    )
  }, [])

  const validateStep1 = () => {
    if (!startDate) {
      setError('Choose a challenge start date.')
      return false
    }
    if (!dietType) {
      setError('Select a diet preference.')
      return false
    }
    setError('')
    return true
  }

  const validateStep2 = () => {
    const { weightKg: w, heightCm: h } = parseMetricBody(
      unitSystem,
      weightMetric,
      weightImperial,
      heightCmField,
      heightFt,
      heightIn
    )
    if (!Number.isFinite(w) || w <= 0 || w > 500) {
      setError('Enter a valid weight.')
      return false
    }
    if (!Number.isFinite(h) || h <= 0 || h > 300) {
      setError('Enter a valid height.')
      return false
    }
    const age = Number(ageField)
    if (!Number.isFinite(age) || age < 16 || age > 80) {
      setError('Enter a valid age (16-80).')
      return false
    }
    setError('')
    return true
  }

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep((s) => Math.min(3, s + 1))
  }

  const handleBack = () => {
    setError('')
    setStep((s) => Math.max(1, s - 1))
  }

  const handleStart = async () => {
    if (!validateStep2() || !macroPreview || !user) return
    setSaving(true)
    setError('')
    const { weightKg: wKg, heightCm: hCm } = parseMetricBody(
      unitSystem,
      weightMetric,
      weightImperial,
      heightCmField,
      heightFt,
      heightIn
    )
    const soft = is75Soft(challengeType)
    const macros = {
      ...macroPreview,
      waterLiters: soft ? 3 : 3.7,
      waterMl: soft ? 3000 : 3700,
    }
    const row = {
      user_id: user.id,
      username,
      weight_kg: Math.round(wKg * 10) / 10,
      height_cm: Math.round(hCm * 10) / 10,
      age: Number(ageField),
      gender,
      diet_type: dietType,
      restrictions: restrictions.length ? restrictions : [],
      start_date: startDate,
      challenge_type: soft ? CHALLENGE_75_SOFT : CHALLENGE_75_HARD,
      macros,
      // NEW
      fitness_interests: fitnessInterests.length ? fitnessInterests : [],
      city: city.trim() || null,
    }
    const { error: saveError } = await supabase
      .from('user_profiles')
      .upsert(row, { onConflict: 'user_id' })
    setSaving(false)
    if (saveError) {
      setError(saveError.message || 'Could not save your profile.')
      return
    }

    const { data: existingAttempt } = await supabase
      .from('attempts')
      .select('id')
      .eq('user_id', user.id)
      .eq('challenge_type', challengeType)
      .limit(1)
      .maybeSingle()
    if (!existingAttempt) {
      const { error: attErr } = await supabase.from('attempts').insert({
        user_id: user.id,
        attempt_number: 1,
        start_date: startDate,
        challenge_type: challengeType,
      })
      if (attErr) {
        setError(attErr.message || 'Profile saved but attempt could not be created.')
        return
      }
    }

    navigate('/dashboard', { replace: true })
  }

  if (!authReady) {
    return <div className="onboarding-loading">Loading…</div>
  }

  return (
    <div className="onboarding">
      <header className="onboarding-header">
        <p className="onboarding-brand">75 Hard · Onboarding</p>
        <div className="onboarding-progress-track" aria-hidden>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`onboarding-progress-seg ${step >= n ? 'onboarding-progress-seg--active' : ''}`}
            />
          ))}
        </div>
        <div className="onboarding-step-labels">
          <span className={step === 1 ? 'onboarding-step-label--current' : ''}>
            1 · Preferences
          </span>
          <span className={step === 2 ? 'onboarding-step-label--current' : ''}>
            2 · Body stats
          </span>
          <span className={step === 3 ? 'onboarding-step-label--current' : ''}>
            3 · Macros
          </span>
        </div>
      </header>

      <main className="onboarding-main">
        <p className="onboarding-setup-tag">
          {is75Soft(challengeType)
            ? 'Setting up your 75 SOFT journey'
            : 'Setting up your 75 HARD journey'}
        </p>
        {step === 1 && (
          <>
            <h1 className="onboarding-title">Your preferences</h1>
            <p className="onboarding-desc">
              When you start and how you eat shapes your plan.
            </p>
            {error ? <p className="onboarding-error">{error}</p> : null}

            <div className="onboarding-field">
              <label htmlFor="start-date">Challenge start date</label>
              <input
                id="start-date"
                className="onboarding-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="onboarding-field">
              <div className="onboarding-field-heading" id="gender-heading">
                Gender
              </div>
              <div
                className="onboarding-btn-group"
                style={{ marginTop: '0.45rem' }}
                role="group"
                aria-labelledby="gender-heading"
              >
                {[
                  { id: 'female', label: 'Female' },
                  { id: 'male', label: 'Male' },
                  { id: 'other', label: 'Other' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={`onboarding-chip ${gender === id ? 'onboarding-chip--selected' : ''}`}
                    onClick={() => setGender(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="onboarding-field">
              <label htmlFor="diet-type">Diet preference</label>
              <select
                id="diet-type"
                className="onboarding-select"
                value={dietType}
                onChange={(e) => setDietType(e.target.value)}
              >
                <option value="">Select…</option>
                {DIET_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="onboarding-field">
              <div className="onboarding-field-heading" id="restrictions-heading">
                Dietary restrictions
              </div>
              <p className="onboarding-desc" style={{ marginBottom: '0.65rem' }}>
                Select any that apply. You can change these later.
              </p>
              <div
                className="onboarding-btn-group"
                role="group"
                aria-labelledby="restrictions-heading"
              >
                {RESTRICTION_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`onboarding-chip ${restrictions.includes(opt) ? 'onboarding-chip--selected' : ''}`}
                    onClick={() => toggleRestriction(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* NEW — fitness interests */}
            <div className="onboarding-field">
              <div className="onboarding-field-heading" id="interests-heading">
                Fitness interests
              </div>
              <p className="onboarding-desc" style={{ marginBottom: '0.65rem' }}>
                What do you train for? Pick all that apply.
              </p>
              <div
                className="onboarding-btn-group"
                role="group"
                aria-labelledby="interests-heading"
              >
                {FITNESS_INTEREST_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`onboarding-chip ${fitnessInterests.includes(opt) ? 'onboarding-chip--selected' : ''}`}
                    onClick={() => toggleFitnessInterest(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* NEW — city */}
            <div className="onboarding-field">
              <label htmlFor="city">Your city</label>
              <input
                id="city"
                className="onboarding-input"
                type="text"
                placeholder="e.g. Bengaluru"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div className="onboarding-actions onboarding-actions--single">
              <button
                type="button"
                className="onboarding-btn onboarding-btn-primary"
                onClick={handleNext}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="onboarding-title">Body stats</h1>
            <p className="onboarding-desc">
              We use this to estimate your daily targets. Stored in metric.
            </p>
            {error ? <p className="onboarding-error">{error}</p> : null}

            <div className="onboarding-field">
              <div className="onboarding-field-heading" id="units-heading">
                Units
              </div>
              <div
                className="onboarding-toggle"
                style={{ marginTop: '0.45rem' }}
                role="group"
                aria-labelledby="units-heading"
              >
                <button
                  type="button"
                  className={unitSystem === 'metric' ? 'onboarding-toggle--active' : ''}
                  onClick={() => setUnitSystem('metric')}
                >
                  Metric (kg / cm)
                </button>
                <button
                  type="button"
                  className={unitSystem === 'imperial' ? 'onboarding-toggle--active' : ''}
                  onClick={() => setUnitSystem('imperial')}
                >
                  Imperial (lb / ft+in)
                </button>
              </div>
            </div>

            <div className="onboarding-field">
              <label htmlFor="weight">
                Weight ({unitSystem === 'metric' ? 'kg' : 'lb'})
              </label>
              <input
                id="weight"
                className="onboarding-input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                placeholder={unitSystem === 'metric' ? 'e.g. 70' : 'e.g. 165'}
                value={unitSystem === 'metric' ? weightMetric : weightImperial}
                onChange={(e) =>
                  unitSystem === 'metric'
                    ? setWeightMetric(e.target.value)
                    : setWeightImperial(e.target.value)
                }
              />
            </div>

            <div className="onboarding-field">
              <label htmlFor="age">Age</label>
              <input
                id="age"
                className="onboarding-input"
                type="number"
                inputMode="numeric"
                min="16"
                max="80"
                step="1"
                placeholder="e.g. 28"
                value={ageField}
                onChange={(e) => setAgeField(e.target.value)}
              />
            </div>

            <div className="onboarding-field">
              {unitSystem === 'metric' ? (
                <>
                  <label htmlFor="height-cm">Height (cm)</label>
                  <input
                    id="height-cm"
                    className="onboarding-input"
                    style={{ marginTop: '0.45rem' }}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    placeholder="e.g. 170"
                    value={heightCmField}
                    onChange={(e) => setHeightCmField(e.target.value)}
                  />
                </>
              ) : (
                <div className="onboarding-row-2" style={{ marginTop: '0.45rem' }}>
                  <div className="onboarding-field" style={{ marginBottom: 0 }}>
                    <label htmlFor="height-ft">Height (ft)</label>
                    <input
                      id="height-ft"
                      className="onboarding-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="1"
                      placeholder="5"
                      value={heightFt}
                      onChange={(e) => setHeightFt(e.target.value)}
                    />
                  </div>
                  <div className="onboarding-field" style={{ marginBottom: 0 }}>
                    <label htmlFor="height-in">Height (in)</label>
                    <input
                      id="height-in"
                      className="onboarding-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="11.99"
                      step="0.1"
                      placeholder="10"
                      value={heightIn}
                      onChange={(e) => setHeightIn(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="onboarding-actions">
              <button
                type="button"
                className="onboarding-btn onboarding-btn-secondary"
                onClick={handleBack}
              >
                Back
              </button>
              <button
                type="button"
                className="onboarding-btn onboarding-btn-primary"
                onClick={handleNext}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="onboarding-title">Your macros</h1>
            <p className="onboarding-desc">
              Estimated from your stats using your selected gender for the
              calculation.
            </p>
            {error ? <p className="onboarding-error">{error}</p> : null}

            {!macroPreview ? (
              <p className="onboarding-error" style={{ marginTop: 0 }}>
                Go back and enter valid weight and height to see macros.
              </p>
            ) : (
              <>
                <div className="onboarding-macro-grid">
                  <div className="onboarding-macro-card">
                    <p className="onboarding-macro-label">Calories</p>
                    <p className="onboarding-macro-value">{macroPreview.calories}</p>
                    <span className="onboarding-macro-unit"> kcal / day</span>
                  </div>
                  <div className="onboarding-macro-card">
                    <p className="onboarding-macro-label">Protein</p>
                    <p className="onboarding-macro-value">{macroPreview.protein}</p>
                    <span className="onboarding-macro-unit"> g</span>
                  </div>
                  <div className="onboarding-macro-card">
                    <p className="onboarding-macro-label">Carbs</p>
                    <p className="onboarding-macro-value">{macroPreview.carbs}</p>
                    <span className="onboarding-macro-unit"> g</span>
                  </div>
                  <div className="onboarding-macro-card">
                    <p className="onboarding-macro-label">Fat</p>
                    <p className="onboarding-macro-value">{macroPreview.fat}</p>
                    <span className="onboarding-macro-unit"> g</span>
                  </div>
                  <div className="onboarding-macro-card">
                    <p className="onboarding-macro-label">Fiber</p>
                    <p className="onboarding-macro-value">{macroPreview.fiber}</p>
                    <span className="onboarding-macro-unit"> g</span>
                  </div>
                  <div className="onboarding-macro-card onboarding-macro-card--wide">
                    <p className="onboarding-macro-label">Water</p>
                    <p className="onboarding-macro-value">{is75Soft(challengeType) ? '3.0' : '3.7'}</p>
                    <span className="onboarding-macro-unit"> L / day (target)</span>
                  </div>
                </div>
                <p className="onboarding-desc" style={{ marginTop: '0.85rem', marginBottom: '0.35rem' }}>
                  {is75Soft(challengeType)
                    ? 'Calculated for 1 daily workout · Activity level: moderate'
                    : 'Calculated for 2 daily workouts · Activity level: moderately active'}
                </p>
                <p className="onboarding-desc" style={{ marginBottom: 0 }}>
                  Based on your stats: {Math.round(weightKg * 10) / 10}kg · {Math.round(heightCm * 10) / 10}cm · Age{' '}
                  {Number(ageField)}
                </p>
              </>
            )}

            <div className="onboarding-actions">
              <button
                type="button"
                className="onboarding-btn onboarding-btn-secondary"
                onClick={handleBack}
                disabled={saving}
              >
                Back
              </button>
              <button
                type="button"
                className="onboarding-btn onboarding-btn-primary"
                onClick={handleStart}
                disabled={saving || !macroPreview}
              >
                {saving ? 'Saving…' : 'Start My Journey'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
