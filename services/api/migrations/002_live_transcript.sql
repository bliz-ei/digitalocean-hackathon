CREATE TABLE transcript_segments (
  session_id uuid NOT NULL REFERENCES sessions(id),
  segment_id text NOT NULL,
  speaker text NOT NULL CHECK (speaker IN ('A', 'B')),
  text text NOT NULL,
  start_ms integer NOT NULL CHECK (start_ms >= 0),
  end_ms integer NOT NULL CHECK (end_ms >= start_ms),
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, segment_id)
);

CREATE INDEX transcript_segments_timeline_idx ON transcript_segments(session_id, start_ms);
