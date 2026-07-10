import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { is75Soft } from '../lib/challenge'
import {
  buildAttemptTimeline,
  buildChallengeGrid,
  buildLogsByDate,
  challengeBadgeLabel,
  computeJourneyStats,
  currentChallengeDay,
  formatJourneyDisplayName,
  formatJourneyStartDate,
  timeAgo,
  todayLocalISO,
} from '../lib/journey'
import './journey.css'

const COMMENTS_PAGE = 10
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

function parseJourneyRpcResponse(raw) {
  if (raw == null) return null

  let parsed = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
  }

  if (!parsed || parsed.error || !parsed.profile) return null
  if (!isValidUuid(parsed.profile.user_id)) return null

  return {
    profile: parsed.profile,
    current_attempt: parsed.current_attempt ?? null,
    attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
    logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    books: Array.isArray(parsed.books) ? parsed.books : [],
    comments: Array.isArray(parsed.comments) ? parsed.comments : null,
    stats: parsed.stats ?? null,
    grid: Array.isArray(parsed.grid) ? parsed.grid : null,
    visitor_count: parsed.visitor_count ?? parsed.view_count ?? 0,
  }
}

async function fetchJourneyPage(username) {
  const slug = String(username ?? '').trim()
  if (!slug) {
    return { parsed: null, error: null, notFound: true }
  }

  const { data, error } = await supabase.rpc('get_journey_page_data', {
    p_username: slug,
  })

  if (error || !data) {
    return { parsed: null, error: error ?? null, notFound: true }
  }

  const parsed = parseJourneyRpcResponse(data)
  if (!parsed) {
    return { parsed: null, error: null, notFound: true }
  }

  return { parsed, error: null, notFound: false }
}

async function fetchComments(profileUserId, limit, offset) {
  if (!isValidUuid(profileUserId)) return []

  const { data, error } = await supabase
    .from('journey_comments')
    .select('id, commenter_name, message, created_at')
    .eq('profile_user_id', profileUserId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return data ?? []
}

export default function Journey() {
  const { username: usernameParam } = useParams()
  const username = decodeURIComponent(usernameParam || '').trim()
  const today = todayLocalISO()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [payload, setPayload] = useState(null)
  const [viewCount, setViewCount] = useState(0)
  const [comments, setComments] = useState([])
  const [commentsVisible, setCommentsVisible] = useState(COMMENTS_PAGE)
  const [hasMoreComments, setHasMoreComments] = useState(false)
  const [commentName, setCommentName] = useState('')
  const [commentMessage, setCommentMessage] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentSuccess, setCommentSuccess] = useState('')
  const [commentCooldown, setCommentCooldown] = useState(false)

  const profile = payload?.profile
  const challengeType = profile?.challenge_type
  const displayName = formatJourneyDisplayName(profile?.username || username)
  const profileUserId = isValidUuid(profile?.user_id) ? profile.user_id : null
  const books = payload?.books ?? []
  const attempts = payload?.attempts ?? []

  const logsByDate = useMemo(
    () => buildLogsByDate(payload?.logs ?? []),
    [payload?.logs],
  )

  const startDate = payload?.current_attempt?.start_date || profile?.start_date
  const attemptNumber = payload?.current_attempt?.attempt_number ?? 1
  const dayNumber = currentChallengeDay(startDate, today)

  const grid = useMemo(() => {
    if (payload?.grid?.length) return payload.grid
    if (!startDate) return []
    return buildChallengeGrid(startDate, logsByDate, challengeType, today)
  }, [payload?.grid, startDate, logsByDate, challengeType, today])

  const stats = useMemo(() => {
    if (payload?.stats) return payload.stats
    return computeJourneyStats(payload?.logs ?? [], challengeType)
  }, [payload?.stats, payload?.logs, challengeType])

  const attemptTimeline = useMemo(
    () => buildAttemptTimeline(attempts, today),
    [attempts, today],
  )

  const loadComments = useCallback(async (uid, visibleCount) => {
    if (!isValidUuid(uid)) return
    const rows = await fetchComments(uid, visibleCount + 1, 0)
    setHasMoreComments(rows.length > visibleCount)
    setComments(rows.slice(0, visibleCount))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setLoadError('')

    ;(async () => {
      try {
        const { parsed, error, notFound: journeyNotFound } = await fetchJourneyPage(username)
        if (cancelled) return
        if (journeyNotFound || error || !parsed?.profile) {
          setNotFound(true)
          setPayload(null)
          return
        }
        setPayload(parsed)
        setViewCount(parsed.visitor_count ?? 0)
        if (parsed.comments) {
          setComments(parsed.comments.slice(0, COMMENTS_PAGE))
          setHasMoreComments(parsed.comments.length > COMMENTS_PAGE)
        } else if (isValidUuid(parsed.profile.user_id)) {
          await loadComments(parsed.profile.user_id, COMMENTS_PAGE)
        }
      } catch {
        if (!cancelled) {
          setNotFound(true)
          setPayload(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [username, loadComments])

  useEffect(() => {
    if (!profileUserId) return
    document.title = `${displayName}'s 75 Hard Journey — Day ${dayNumber} of 75 | Unlock75`
    return () => {
      document.title = 'Unlock75'
    }
  }, [displayName, dayNumber, profileUserId])

  useEffect(() => {
    if (!isValidUuid(profileUserId)) return

    let cancelled = false
    ;(async () => {
      const { error } = await supabase.from('journey_views').insert({
        profile_user_id: profileUserId,
        visitor_ip: null,
      })
      if (!cancelled && !error) {
        setViewCount((c) => c + 1)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [profileUserId])

  async function handleShowMoreComments() {
    if (!isValidUuid(profileUserId)) return
    const next = commentsVisible + COMMENTS_PAGE
    setCommentsVisible(next)
    try {
      await loadComments(profileUserId, next)
    } catch {
      /* keep existing comments */
    }
  }

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
      setComments((prev) => [data, ...prev].slice(0, commentsVisible))
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

  if (loadError || !profile) {
    return (
      <div className="journey-page">
        <div className="journey-empty">
          <h1>Something went wrong</h1>
          <p>{loadError || 'Try again in a moment.'}</p>
        </div>
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

      <section className="journey-section" aria-labelledby="journey-grid-title">
        <h2 id="journey-grid-title" className="journey-section-title">
          75-day progress
        </h2>
        <div className="journey-grid" role="list">
          {grid.map((cell) => (
            <div
              key={cell.day}
              role="listitem"
              className={`journey-grid-cell journey-grid-cell--${cell.status}`}
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
            <p className="journey-stat-value">{stats.daysWithActivity}</p>
            <p className="journey-stat-label">Days Completed</p>
          </article>
          <article className="journey-stat-card">
            <p className="journey-stat-value">{stats.totalWaterLiters}L</p>
            <p className="journey-stat-label">Total Water</p>
          </article>
          <article className="journey-stat-card">
            <p className="journey-stat-value">{stats.workoutsDone}</p>
            <p className="journey-stat-label">Workouts Done</p>
          </article>
          <article className="journey-stat-card">
            <p className="journey-stat-value">{stats.readingDays}</p>
            <p className="journey-stat-label">Reading Days</p>
          </article>
          <article className="journey-stat-card journey-stat-card--books">
            <p className="journey-stat-label">Books</p>
            {books.length ? (
              <ul className="journey-books">
                {books.map((b, i) => (
                  <li key={`${b.title}-${i}`}>{b.title}</li>
                ))}
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
      </section>

      <section className="journey-section" aria-labelledby="journey-comments-title">
        <h2 id="journey-comments-title" className="journey-section-title">
          Cheer {displayName} on 💪
        </h2>
        <div className="journey-comments">
          {comments.length === 0 ? (
            <p className="journey-stat-muted">Be the first to leave a message of support.</p>
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
        {hasMoreComments ? (
          <button
            type="button"
            className="journey-show-more"
            onClick={() => void handleShowMoreComments()}
          >
            Show more
          </button>
        ) : null}

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
      </section>

      <aside className="journey-cta-banner">
        <p className="journey-cta-text">Want to track your own 75 Hard journey?</p>
        <Link to="/" className="journey-cta-btn">
          Start for free — unlock75.app
        </Link>
      </aside>
    </div>
  )
}
