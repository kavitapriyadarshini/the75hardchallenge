import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { is75Soft } from '../lib/challenge'
import {
  buildAttemptTimeline,
  buildChallengeGrid,
  buildLogsByDate,
  challengeBadgeLabel,
  currentChallengeDay,
  formatJourneyDisplayName,
  formatJourneyStartDate,
  timeAgo,
  todayLocalISO,
} from '../lib/journey'
import './journey.css'

const COMMENT_COOLDOWN_MS = 30_000
const JOURNEY_NOT_FOUND_MESSAGE =
  'Journey not found. The username may be incorrect.'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUuid(value) {
  if (value == null || value === '') return false
  const s = String(value).trim()
  if (s === 'undefined' || s === 'null') return false
  return UUID_RE.test(s)
}

async function fetchAllComments(profileUserId) {
  if (!isValidUuid(profileUserId)) return []

  const { data, error } = await supabase
    .from('journey_comments')
    .select('id, commenter_name, message, created_at')
    .eq('profile_user_id', profileUserId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

async function recordViewAndGetCount(profileUserId) {
  if (!isValidUuid(profileUserId)) return 0

  await supabase.from('journey_views').insert({
    profile_user_id: profileUserId,
    viewed_at: new Date().toISOString(),
  })

  const { count, error } = await supabase
    .from('journey_views')
    .select('*', { count: 'exact', head: true })
    .eq('profile_user_id', profileUserId)

  if (error || count == null) return 0
  return count
}

export default function Journey() {
  const { username: usernameParam } = useParams()
  const username = decodeURIComponent(usernameParam || '').trim()
  const today = todayLocalISO()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [journeyData, setJourneyData] = useState(null)
  const [viewCount, setViewCount] = useState(0)
  const [comments, setComments] = useState([])
  const [commentName, setCommentName] = useState('')
  const [commentMessage, setCommentMessage] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentSuccess, setCommentSuccess] = useState('')
  const [commentCooldown, setCommentCooldown] = useState(false)

  const profile = journeyData?.profile
  const challengeType = profile?.challenge_type
  const displayName = formatJourneyDisplayName(profile?.username || username)
  const profileUserId = isValidUuid(profile?.user_id) ? profile.user_id : null
  const books = journeyData?.books ?? []
  const attempts = journeyData?.attempts ?? []
  const rpcStats = journeyData?.stats ?? {}

  const daysLogged = rpcStats.days_logged ?? 0
  const totalWaterLabel = `${((Number(rpcStats.total_water_ml) || 0) / 1000).toFixed(1)}L`
  const workoutsDone = rpcStats.workouts_done ?? 0
  const readingDays = rpcStats.reading_days ?? 0
  const workoutBreakdown = useMemo(() => {
    const counts = {}
    for (const log of journeyData?.grid ?? []) {
      if (log.workout_1_done && log.workout_1_name) {
        counts[log.workout_1_name] = (counts[log.workout_1_name] || 0) + 1
      }
      if (log.workout_2_done && log.workout_2_name) {
        counts[log.workout_2_name] = (counts[log.workout_2_name] || 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [journeyData?.grid])
  
  const readingBreakdown = useMemo(() => {
    const counts = {}
    for (const log of journeyData?.grid ?? []) {
      if (log.reading_done && log.reading_log?.book_title) {
        const title = log.reading_log.book_title
        counts[title] = (counts[title] || 0) + 1
      }
    }
    return Object.entries(counts)
  }, [journeyData?.grid])
  const startDate = journeyData?.current_attempt?.start_date || profile?.start_date
  const attemptNumber = journeyData?.current_attempt?.attempt_number ?? 1
  const dayNumber = currentChallengeDay(startDate, today)
  const priorAttempts = Math.max(0, attemptNumber - 1)

  const logsByDate = useMemo(
    () => buildLogsByDate(journeyData?.grid ?? []),
    [journeyData?.grid],
  )

  const grid = useMemo(() => {
    if (!startDate) return []
    return buildChallengeGrid(startDate, logsByDate, challengeType, today)
  }, [startDate, logsByDate, challengeType, today])

  const attemptTimeline = useMemo(
    () => buildAttemptTimeline(attempts, today),
    [attempts, today],
  )

  const loadComments = useCallback(async (uid) => {
    if (!isValidUuid(uid)) return
    const rows = await fetchAllComments(uid)
    setComments(rows)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.rpc('get_journey_page_data', {
        p_username: username,
      })

      if (error || !data) {
        setNotFound(true)
        setJourneyData(null)
        setLoading(false)
        return
      }

      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data

        if (!parsed?.profile) {
          setNotFound(true)
          setJourneyData(null)
          setLoading(false)
          return
        }

        setNotFound(false)
        setJourneyData(parsed)

        if (Array.isArray(parsed.comments)) {
          setComments(parsed.comments)
        } else if (isValidUuid(parsed.profile.user_id)) {
          await loadComments(parsed.profile.user_id)
        }

        if (isValidUuid(parsed.profile.user_id)) {
          const count = await recordViewAndGetCount(parsed.profile.user_id)
          setViewCount(count)
        } else {
          setViewCount(parsed.visitor_count ?? parsed.view_count ?? 0)
        }
      } catch {
        setNotFound(true)
        setJourneyData(null)
      } finally {
        setLoading(false)
      }
    }

    if (username) {
      setLoading(true)
      setNotFound(false)
      void fetchData()
    } else {
      setLoading(false)
      setNotFound(true)
      setJourneyData(null)
    }
  }, [username, loadComments])

  useEffect(() => {
    if (!profileUserId) return
    document.title = `${displayName}'s 75 Hard Journey — Day ${dayNumber} of 75 | Unlock75`
    return () => {
      document.title = 'Unlock75'
    }
  }, [displayName, dayNumber, profileUserId])

  async function handleSubmitComment(e) {
    e.preventDefault()
    if (!isValidUuid(profileUserId) || commentCooldown || commentBusy) return

    const name = commentName.trim().slice(0, 50)
    const message = commentMessage.trim().slice(0, 200)
    if (!name || !message) return

    setCommentBusy(true)
    setCommentSuccess('')
    try {
      const { data, error } = await supabase
        .from('journey_comments')
        .insert({
          profile_user_id: profileUserId,
          commenter_name: name,
          message,
        })
        .select('id, commenter_name, message, created_at')
        .single()
      if (error) throw error
      setComments((prev) => [data, ...prev])
      setCommentName('')
      setCommentMessage('')
      setCommentSuccess('Your message was sent! 🙌')
      setCommentCooldown(true)
      window.setTimeout(() => setCommentCooldown(false), COMMENT_COOLDOWN_MS)
    } catch {
      setCommentSuccess('')
    } finally {
      setCommentBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="journey-page">
        <div className="journey-loading">Loading journey…</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="journey-page">
        <div className="journey-empty">
          <h1>Journey not found</h1>
          <p>{JOURNEY_NOT_FOUND_MESSAGE}</p>
          <Link to="/" className="journey-cta-btn">
            Start for free — unlock75.app
          </Link>
        </div>
      </div>
    )
  }

  if (!journeyData?.profile) {
    return (
      <div className="journey-page">
        <div className="journey-loading">Loading journey…</div>
      </div>
    )
  }

  const soft = is75Soft(challengeType)
  const badge = challengeBadgeLabel(challengeType)

  return (
    <div className="journey-page">
      <header className="journey-hero">
        <p className="journey-hero-day">
          DAY <span>{dayNumber}</span> of 75
        </p>
        <span
          className={`journey-badge ${soft ? 'journey-badge--soft' : 'journey-badge--hard'}`}
        >
          {badge}
        </span>
        <p className="journey-hero-tagline">
          Attempt #{attemptNumber} — Started {formatJourneyStartDate(startDate)}
        </p>
        <p className="journey-visitor-count" aria-live="polite">
          👀 {viewCount.toLocaleString()} {viewCount === 1 ? 'person has' : 'people have'}{' '}
          followed this journey
        </p>
      </header>

      <div className="journey-body">
        <div className="journey-main">
          <section className="journey-section" aria-labelledby="journey-grid-title">
            <h2 id="journey-grid-title" className="journey-section-title">
              75-day progress
            </h2>
            <div className="journey-grid" role="list">
              {grid.map((cell) => (
                <div
                  key={cell.day}
                  role="listitem"
                  className={`journey-grid-cell journey-grid-cell--${cell.status}${cell.date === today ? ' journey-grid-cell--today' : ''}`}
                  title={`Day ${cell.day} — ${cell.label}`}
                  aria-label={`Day ${cell.day} — ${cell.label}`}
                >
                  {cell.day}
                </div>
              ))}
            </div>
            <div className="journey-legend">
              <span>
                <i className="journey-legend-swatch journey-legend-swatch--complete" /> Complete
              </span>
              <span>
                <i className="journey-legend-swatch journey-legend-swatch--partial" /> Incomplete
              </span>
              <span>
                <i className="journey-legend-swatch journey-legend-swatch--future" /> Upcoming
              </span>
              {!soft ? (
                <span>
                  <i className="journey-legend-swatch journey-legend-swatch--missed" /> Missed
                </span>
              ) : null}
            </div>
          </section>

          <section className="journey-section" aria-labelledby="journey-stats-title">
            <h2 id="journey-stats-title" className="journey-section-title">
              Stats
            </h2>
            <div className="journey-stats">
              <article className="journey-stat-card">
                <p className="journey-stat-value">{daysLogged}</p>
                <p className="journey-stat-label">Days Completed</p>
              </article>
              <article className="journey-stat-card">
                <p className="journey-stat-value">{totalWaterLabel}</p>
                <p className="journey-stat-label">Total Water</p>
              </article>
              <article className="journey-stat-card journey-stat-card--books">
  <p className="journey-stat-value">{workoutsDone * 2}</p>
  <p className="journey-stat-label">Workouts Done</p>
  {workoutBreakdown.length > 0 && (
    <ul className="journey-books" style={{marginTop: '0.5rem'}}>
      {workoutBreakdown.map(([name, count]) => (
        <li key={name} className="journey-book--done">
          {name} — {count}x
        </li>
      ))}
    </ul>
  )}
</article>
<article className="journey-stat-card journey-stat-card--books">
  <p className="journey-stat-value">{readingDays}</p>
  <p className="journey-stat-label">Reading Days</p>
  {readingBreakdown.length > 0 && (
    <ul className="journey-books" style={{marginTop: '0.5rem'}}>
      {readingBreakdown.map(([title, days]) => {
        const isCurrent = books[books.length - 1]?.title === title
        return (
          <li key={title} className={isCurrent ? 'journey-book--reading' : 'journey-book--done'}>
            {title} — {days} days {isCurrent ? '📖' : '✅'}
          </li>
        )
      })}
    </ul>
  )}
</article>
              <article className="journey-stat-card journey-stat-card--books">
                <p className="journey-stat-label">Books</p>
                {books.length ? (
                  <ul className="journey-books">
                    {books.map((b, i) => {
                      const isCurrent = i === books.length - 1
                      return (
                        <li
                          key={`${b.title}-${i}`}
                          className={isCurrent ? 'journey-book--reading' : 'journey-book--done'}
                        >
                          {b.title} {isCurrent ? '📖 (In Progress)' : '✅'}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="journey-stat-muted">No books logged yet</p>
                )}
              </article>
            </div>
          </section>

          <section className="journey-section" aria-labelledby="journey-attempts-title">
            <h2 id="journey-attempts-title" className="journey-section-title">
              Attempt history
            </h2>
            <ol className="journey-timeline">
              {attemptTimeline.map((att) => (
                <li key={att.id ?? att.attempt_number} className="journey-timeline-item">
                  {att.isCurrent ? (
                    <>
                      Attempt {att.attempt_number} — <strong>Current 🔥</strong>
                    </>
                  ) : (
                    <>
                      Attempt {att.attempt_number} — ended Day {att.dayReached || 0}
                    </>
                  )}
                </li>
              ))}
            </ol>
            {priorAttempts > 0 ? (
              <p className="journey-attempt-note">
                {displayName} attempted this challenge {priorAttempts}{' '}
                {priorAttempts === 1 ? 'time' : 'times'} before finding the right system to stay
                consistent.
              </p>
            ) : null}
          </section>
        </div>

        <aside className="journey-wall" aria-labelledby="journey-wall-title">
          <div className="journey-wall-panel">
            <h2 id="journey-wall-title" className="journey-wall-title">
              Motivation Wall 💌
            </h2>
            <div className="journey-comments">
              {comments.length === 0 ? (
                <p className="journey-stat-muted">
                  Be the first to cheer {displayName} on! 💪
                </p>
              ) : (
                comments.map((c) => (
                  <article key={c.id} className="journey-comment-card">
                    <p className="journey-comment-name">{c.commenter_name}</p>
                    <p className="journey-comment-message">{c.message}</p>
                    <p className="journey-comment-time">{timeAgo(c.created_at)}</p>
                  </article>
                ))
              )}
            </div>

            <form className="journey-comment-form" onSubmit={(e) => void handleSubmitComment(e)}>
              <label className="journey-form-label" htmlFor="journey-comment-name">
                Your name
              </label>
              <input
                id="journey-comment-name"
                className="journey-form-input"
                type="text"
                maxLength={50}
                required
                placeholder="Your name"
                value={commentName}
                onChange={(e) => setCommentName(e.target.value)}
                disabled={commentBusy || commentCooldown}
              />
              <label className="journey-form-label" htmlFor="journey-comment-message">
                Message
              </label>
              <textarea
                id="journey-comment-message"
                className="journey-form-textarea"
                maxLength={200}
                required
                rows={3}
                placeholder="Leave a message of support..."
                value={commentMessage}
                onChange={(e) => setCommentMessage(e.target.value)}
                disabled={commentBusy || commentCooldown}
              />
              <p className="journey-char-count">{commentMessage.length}/200</p>
              {commentSuccess ? (
                <p className="journey-comment-success" role="status">
                  {commentSuccess}
                </p>
              ) : null}
              <button
                type="submit"
                className="journey-submit-btn"
                disabled={commentBusy || commentCooldown}
              >
                Send 💪
              </button>
            </form>
          </div>
        </aside>
      </div>

      <aside className="journey-cta-banner">
        <p className="journey-cta-text">Want to track your own 75 Hard journey?</p>
        <Link to="/" className="journey-cta-btn">
          Start for free — unlock75.app
        </Link>
      </aside>
    </div>
  )
}
