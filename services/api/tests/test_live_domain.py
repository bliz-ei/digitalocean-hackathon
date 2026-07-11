import pytest
from pydantic import ValidationError

from app.domain.live import AudioLedger, ClaimDeduplicator, SentenceAssembler, SpeakerMapper
from app.domain.models import ClassificationResult, TranscriptSegment


def segment(segment_id, speaker, text, start, end):
    return TranscriptSegment(segment_id=segment_id, speaker=speaker, text=text, start_ms=start, end_ms=end)


def test_audio_ledger_acknowledges_contiguous_chunks_and_ignores_replay():
    ledger = AudioLedger(max_buffered_chunks=4)
    assert ledger.accept(1) == (True, -1)
    assert ledger.accept(0) == (True, 1)
    assert ledger.accept(1) == (False, 1)
    with pytest.raises(ValueError):
        ledger.accept(8)


def test_speaker_mapper_is_stable_for_many_speakers():
    mapper = SpeakerMapper()
    assert [mapper.map("provider-7"), mapper.map("provider-2"), mapper.map("provider-9"), mapper.map("provider-7")] == ["A", "B", "C", "A"]
    for index in range(3, 26):
        assert mapper.map(f"extra-{index}") == chr(ord("A") + index)
    with pytest.raises(ValueError):
        mapper.map("overflow")


def test_sentence_assembly_handles_switches_repeated_finals_and_backchannels():
    assembler = SentenceAssembler()
    assert assembler.add(segment("1", "A", "Electric vehicles produce", 100, 800)) == []
    candidates = assembler.add(segment("2", "A", "no carbon emissions.", 800, 1500))
    assert [(item.speaker, item.exact_text, item.start_ms, item.end_ms) for item in candidates] == [
        ("A", "Electric vehicles produce no carbon emissions.", 100, 1500)
    ]
    assert assembler.add(segment("2", "A", "no carbon emissions.", 800, 1500)) == []
    assert assembler.add(segment("3", "B", "Yeah.", 1600, 1700)) == []
    assert assembler.add(segment("4", "A", "I think that design is beautiful.", 1800, 2400))[0].context_before == "Yeah."


def test_claim_deduplication_is_windowed_and_deterministic():
    dedupe = ClaimDeduplicator(window_ms=60_000)
    assert dedupe.accept("Electric vehicles produce no carbon emissions.", 10_000)
    assert not dedupe.accept(" electric vehicles produce no carbon emissions ", 20_000)
    assert dedupe.accept("Electric vehicles produce no carbon emissions", 80_001)


def test_classification_schema_fails_closed():
    with pytest.raises(ValidationError):
        ClassificationResult(candidate_id="x", classification="factual_claim", normalized_claim="claim")
    with pytest.raises(ValidationError):
        ClassificationResult(candidate_id="x", classification="opinion", normalized_claim="claim")
