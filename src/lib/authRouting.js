import { supabase } from './supabase'

function challengeTypeLooksValid(raw) {
  const t = String(raw ?? '').toLowerCase().trim()
  return t === '75hard' || t === '75soft'
}

/** Where to send a signed-in user based on profile state (matches Login.jsx). */
export async function resolvePostLoginPath(userId) {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id, challenge_type')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !profile) return '/challenge-select'
  if (!challengeTypeLooksValid(profile.challenge_type)) return '/challenge-select'
  return '/dashboard'
}
