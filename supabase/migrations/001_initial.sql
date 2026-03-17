-- Rooms: persisted for audit. Live game state is in-memory on server.
CREATE TABLE rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL UNIQUE,
  question     TEXT NOT NULL,
  answers      TEXT[] NOT NULL,
  status       TEXT NOT NULL DEFAULT 'waiting'
                 CHECK (status IN ('waiting', 'playing', 'finished')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ
);

-- Results: written once on game_over. No player data stored.
CREATE TABLE results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  winner_team_index   SMALLINT NOT NULL,
  winner_answer       TEXT NOT NULL,
  team_player_counts  JSONB NOT NULL,
  total_ticks         INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON rooms (code) WHERE status != 'finished';
CREATE INDEX ON results (room_id);

ALTER TABLE rooms   ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Clients can read rooms to validate codes
CREATE POLICY "rooms_public_read" ON rooms FOR SELECT USING (true);
-- Service-role key (server) bypasses RLS for writes
