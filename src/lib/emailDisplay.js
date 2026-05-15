/** Local part before @ for a friendly label (e.g. "kavita" from "kavita@gmail.com"). */
export function friendlyDisplayFromEmail(email) {
  if (!email || typeof email !== 'string') return ''
  const t = email.trim()
  const i = t.indexOf('@')
  return i > 0 ? t.slice(0, i) : t
}
