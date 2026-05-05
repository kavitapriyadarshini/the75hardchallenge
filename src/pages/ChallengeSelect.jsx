import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CHALLENGE_75_HARD, CHALLENGE_75_SOFT } from '../lib/challenge'
import './challenge-select.css'

const ROWS = [
  {
    label: 'Workouts',
    hard: '2× / day (45 min each), 1 must be outdoors',
    soft: '1× / day (45 min), any location · 1 recovery day/week',
  },
  {
    label: 'Water',
    hard: '3.7 L',
    soft: '3 L',
  },
  {
    label: 'Nutrition',
    hard: 'Strict clean diet',
    soft: 'Eat well · up to 1 social drink/week',
  },
  {
    label: 'Reading',
    hard: '10 pages non-fiction',
    soft: '10 pages non-fiction',
  },
  {
    label: 'Photo',
    hard: 'Progress photo daily',
    soft: 'Not required',
  },
  {
    label: 'On a miss',
    hard: 'Restart from Day 1',
    soft: 'No programme restart — keep going',
  },
]

export default function ChallengeSelect() {
  const navigate = useNavigate()

  const pick = async (type) => {
    const safe = type === CHALLENGE_75_SOFT ? CHALLENGE_75_SOFT : CHALLENGE_75_HARD
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user?.id) {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (prof?.user_id) {
        await supabase.from('user_profiles').update({ challenge_type: safe }).eq('user_id', user.id)
      }
    }
    navigate('/onboarding', { replace: true, state: { challengeType: safe } })
  }

  return (
    <div className="challenge-select-page">
      <header className="challenge-select-header">
        <p className="challenge-select-brand">75 Hard Suite</p>
        <h1 className="challenge-select-title">Choose your challenge</h1>
        <p className="challenge-select-sub">
          Pick what fits today. You can switch later from Profile (it resets your day count).
        </p>
      </header>

      <div className="challenge-select-cards">
        <div className="challenge-card challenge-card--hard">
          <h2 className="challenge-card-title challenge-card-title--hard">75 HARD</h2>
          <p className="challenge-card-sub">The original mental toughness challenge.</p>
          <ul className="challenge-card-ul">
            <li>2 workouts / day — one outdoors</li>
            <li>3.7L water</li>
            <li>Strict clean diet</li>
            <li>10 pages reading</li>
            <li>Daily progress photo</li>
            <li>Restart on any miss</li>
          </ul>
          <span className="challenge-badge challenge-badge--adv">ADVANCED</span>
          <button
            type="button"
            className="challenge-card-select challenge-card-select--hard"
            onClick={() => void pick(CHALLENGE_75_HARD)}
          >
            Select 75 HARD
          </button>
        </div>

        <div className="challenge-card challenge-card--soft">
          <h2 className="challenge-card-title challenge-card-title--soft">75 SOFT</h2>
          <p className="challenge-card-sub">Build the foundation. Prove it to yourself.</p>
          <ul className="challenge-card-ul">
            <li>1 workout / day (any) · 1 rest day/week</li>
            <li>3L water</li>
            <li>Eat well (1 social drink/week ok)</li>
            <li>10 pages reading</li>
            <li>No photo required</li>
            <li>No restart on miss</li>
          </ul>
          <span className="challenge-badge challenge-badge--begin">BEGINNER FRIENDLY</span>
          <button
            type="button"
            className="challenge-card-select challenge-card-select--soft"
            onClick={() => void pick(CHALLENGE_75_SOFT)}
          >
            Select 75 SOFT
          </button>
        </div>
      </div>

      <section className="challenge-compare" aria-labelledby="compare-heading">
        <h2 id="compare-heading" className="challenge-compare-heading">
          Side-by-side comparison
        </h2>
        <div className="challenge-table-wrap">
          <table className="challenge-table">
            <thead>
              <tr>
                <th className="challenge-table-criteria">Criteria</th>
                <th className="challenge-hard-col">75 HARD</th>
                <th className="challenge-soft-col">75 SOFT</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label}>
                  <td className="challenge-table-criteria">{r.label}</td>
                  <td className="challenge-hard-col">{r.hard}</td>
                  <td className="challenge-soft-col">{r.soft}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="challenge-note">
          You’ll set body stats next. Your choice is saved when you finish onboarding.
        </p>
      </section>
    </div>
  )
}
