import asyncio

from app.domain.models import ClaimCandidate, ClassificationResult, TranscriptSegment
from app.persistence.repository import MemoryRepository
from app.pipeline.live import LiveSession
from app.providers.live import OpenAICompatibleFastClassifier, RecordedFastClassifier, RecordedSttAdapter


def test_recorded_transcript_creates_one_canonical_claim(tmp_path):
    asyncio.run(recorded_transcript_creates_one_canonical_claim(tmp_path))


async def recorded_transcript_creates_one_canonical_claim(tmp_path):
    fixture = tmp_path / "stt.json"
    fixture.write_text('{"events":[{"segment":{"segment_id":"1","speaker":"A","text":"Electric vehicles produce no carbon emissions.","start_ms":12000,"end_ms":15400,"is_final":true}}]}')
    events = []
    repo = MemoryRepository()
    session_id = repo.create_session("key", "session")
    live = LiveSession(session_id, repo, RecordedSttAdapter(fixture), RecordedFastClassifier(), lambda kind, payload: capture(events, kind, payload))
    await live.start("stream")
    await live.stt.send(b"audio", 0)
    await asyncio.gather(*live.tasks)
    await live.on_transcript(TranscriptSegment(segment_id="1",speaker="A",text="Electric vehicles produce no carbon emissions.",start_ms=12000,end_ms=15400))
    claims = list(repo.claims.values())
    assert len(claims) == 1
    assert claims[0].speaker_label == "Speaker A"
    assert claims[0].state == "CHECKING"
    assert sum(kind == "claim_state" for kind, _ in events) == 1


def test_client_classification_ignores_stale_and_opinion_results():
    asyncio.run(client_classification_ignores_stale_and_opinion_results())


async def client_classification_ignores_stale_and_opinion_results():
    events = []
    repo = MemoryRepository()
    live = LiveSession("session", repo, RecordedSttAdapter(), None, lambda kind, payload: capture(events, kind, payload))
    stale = ClassificationResult(candidate_id="missing", classification="opinion")
    assert await live.classification(stale) is None
    assert events[-1][0] == "classification_stale"


async def capture(events, kind, payload):
    events.append((kind, payload))


def test_team_classifier_uses_the_same_strict_contract():
    classifier = OpenAICompatibleFastClassifier("https://provider.example", "secret", "fast")
    classifier._request = lambda _: {
        "choices": [{"message": {"content": '{"classification":"opinion","normalized_claim":null,"neutral_queries":[],"support_queries":[],"counter_queries":[]}'}}]
    }  # type: ignore[method-assign]
    candidate = ClaimCandidate(
        candidate_id="candidate", speaker="A", exact_text="I think it looks better.",
        normalized_text="I think it looks better.", start_ms=1, end_ms=2,
    )
    result = asyncio.run(classifier.classify(candidate))
    assert result.classification == "opinion"
    assert result.provider == "openai-compatible"
    assert result.prompt_version == "phase2-v1"
