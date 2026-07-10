-- Public journey page: visitor counter, comments, and secure read RPC.
-- Run in Supabase SQL editor. Does NOT alter progress_photo or other sensitive columns.

-- Visitor counter
CREATE TABLE IF NOT EXISTS journey_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_user_id uuid REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  visitor_ip text
);

-- Comments / well wishes
CREATE TABLE IF NOT EXISTS journey_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_user_id uuid REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  commenter_name text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journey_views_profile_idx ON journey_views (profile_user_id);
CREATE INDEX IF NOT EXISTS journey_comments_profile_idx ON journey_comments (profile_user_id, created_at DESC);

ALTER TABLE journey_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can record a view and read view counts
CREATE POLICY journey_views_insert_public
  ON journey_views FOR INSERT TO anon, authenticated
  WITH CHECK (profile_user_id IS NOT NULL);

CREATE POLICY journey_views_select_public
  ON journey_views FOR SELECT TO anon, authenticated
  USING (true);

-- Anyone can read comments; anyone can post (name + message only)
CREATE POLICY journey_comments_select_public
  ON journey_comments FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY journey_comments_insert_public
  ON journey_comments FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(trim(commenter_name)) BETWEEN 1 AND 50
    AND char_length(trim(message)) BETWEEN 1 AND 200
  );

GRANT SELECT, INSERT ON journey_views TO anon, authenticated;
GRANT SELECT, INSERT ON journey_comments TO anon, authenticated;

-- Single RPC: public journey data only (no photos, meals, body stats, notes)
CREATE OR REPLACE FUNCTION public.get_journey_page_data(p_username text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_username text;
  v_challenge_type text;
  v_start_date date;
  v_current_attempt attempts%ROWTYPE;
  v_log_end date;
  v_stats jsonb;
BEGIN
  SELECT up.user_id, up.username, up.challenge_type, up.start_date
  INTO v_user_id, v_username, v_challenge_type, v_start_date
  FROM user_profiles up
  WHERE lower(trim(up.username)) = lower(trim(p_username))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_current_attempt
  FROM attempts a
  WHERE a.user_id = v_user_id
    AND a.challenge_type = v_challenge_type
  ORDER BY a.attempt_number DESC
  LIMIT 1;

  IF v_current_attempt.id IS NULL THEN
    RETURN jsonb_build_object(
      'profile', jsonb_build_object(
        'user_id', v_user_id,
        'username', v_username,
        'challenge_type', v_challenge_type,
        'start_date', v_start_date
      ),
      'current_attempt', NULL,
      'attempts', '[]'::jsonb,
      'logs', '[]'::jsonb,
      'stats', jsonb_build_object(
        'days_logged', 0,
        'total_water_ml', 0,
        'workouts_done', 0,
        'reading_days', 0
      ),
      'books', (
        SELECT coalesce(jsonb_agg(jsonb_build_object('title', b.title) ORDER BY b.created_at ASC), '[]'::jsonb)
        FROM reading_books b
        WHERE b.user_id = v_user_id
      ),
      'view_count', (SELECT count(*)::int FROM journey_views jv WHERE jv.profile_user_id = v_user_id)
    );
  END IF;

  v_log_end := v_current_attempt.start_date + 74;

  SELECT coalesce(
    jsonb_build_object(
      'days_logged', count(*) FILTER (WHERE
        coalesce(d.diet_done, false)
        OR coalesce(d.workout_1_done, d.indoor_done, false)
        OR coalesce(d.workout_2_done, d.outdoor_done, false)
        OR coalesce(d.reading_done, false)
        OR coalesce(d.photo_done, false)
        OR coalesce(d.water_ml, 0) > 0
        OR coalesce(d.is_recovery_day, false)
      ),
      'total_water_ml', coalesce(sum(d.water_ml), 0),
      'workouts_done', count(*) FILTER (WHERE coalesce(d.workout_1_done, d.indoor_done, false)),
      'reading_days', count(*) FILTER (WHERE coalesce(d.reading_done, false))
    ),
    jsonb_build_object(
      'days_logged', 0,
      'total_water_ml', 0,
      'workouts_done', 0,
      'reading_days', 0
    )
  )
  INTO v_stats
  FROM daily_logs d
  WHERE d.user_id = v_user_id
    AND d.date >= v_current_attempt.start_date
    AND d.date <= v_log_end;

  RETURN jsonb_build_object(
    'profile', jsonb_build_object(
      'user_id', v_user_id,
      'username', v_username,
      'challenge_type', v_challenge_type,
      'start_date', v_start_date
    ),
    'current_attempt', jsonb_build_object(
      'id', v_current_attempt.id,
      'attempt_number', v_current_attempt.attempt_number,
      'start_date', v_current_attempt.start_date,
      'ended_at', v_current_attempt.ended_at,
      'challenge_type', v_current_attempt.challenge_type
    ),
    'attempts', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'attempt_number', a.attempt_number,
            'start_date', a.start_date,
            'ended_at', a.ended_at,
            'challenge_type', a.challenge_type
          )
          ORDER BY a.attempt_number ASC
        ),
        '[]'::jsonb
      )
      FROM attempts a
      WHERE a.user_id = v_user_id
        AND a.challenge_type = v_challenge_type
    ),
    'logs', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'date', d.date,
            'water_ml', coalesce(d.water_ml, 0),
            'diet_done', coalesce(d.diet_done, false),
            'reading_done', coalesce(d.reading_done, false),
            'workout_1_done', coalesce(d.workout_1_done, d.indoor_done, false),
            'workout_2_done', coalesce(d.workout_2_done, d.outdoor_done, false),
            'indoor_done', coalesce(d.indoor_done, false),
            'outdoor_done', coalesce(d.outdoor_done, false),
            'photo_done', coalesce(d.photo_done, false),
            'is_recovery_day', coalesce(d.is_recovery_day, false)
          )
          ORDER BY d.date ASC
        ),
        '[]'::jsonb
      )
      FROM daily_logs d
      WHERE d.user_id = v_user_id
        AND d.date >= v_current_attempt.start_date
        AND d.date <= v_log_end
    ),
    'stats', v_stats,
    'books', (
      SELECT coalesce(
        jsonb_agg(jsonb_build_object('title', b.title) ORDER BY b.created_at ASC),
        '[]'::jsonb
      )
      FROM reading_books b
      WHERE b.user_id = v_user_id
    ),
    'view_count', (SELECT count(*)::int FROM journey_views jv WHERE jv.profile_user_id = v_user_id)
  );
END;
$$;

-- Enable realtime for live visitor counts (Supabase Dashboard → Database → Publications):
-- ALTER PUBLICATION supabase_realtime ADD TABLE journey_views;
