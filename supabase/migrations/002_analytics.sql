-- Analytics: tracks key events without storing personal data
CREATE TABLE IF NOT EXISTS visits (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event      text        NOT NULL, -- 'page_view' | 'room_created' | 'player_joined' | 'game_completed'
  room_code  text,
  language   text,                 -- navigator.language (e.g. 'es-MX', 'en-US')
  device     text,                 -- 'mobile' | 'desktop'
  referrer   text,                 -- document.referrer or 'direct'
  created_at timestamptz DEFAULT now()
);

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- Anyone can insert events (no auth needed), nobody can read them publicly
CREATE POLICY "anon_insert" ON visits FOR INSERT TO anon WITH CHECK (true);
