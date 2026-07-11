ALTER TABLE transcript_segments
  DROP CONSTRAINT IF EXISTS transcript_segments_speaker_check;
ALTER TABLE transcript_segments
  ADD CONSTRAINT transcript_segments_speaker_check CHECK (speaker IN ('A', 'B'));
