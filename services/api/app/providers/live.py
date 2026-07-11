import asyncio
import json
import os
from contextlib import suppress
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Protocol

from app.domain.live import SpeakerMapper, normalize_text
from app.domain.models import Classification, ClassificationResult, ClaimCandidate, TranscriptSegment


ROOT = Path(__file__).parents[4]
TranscriptSink = Callable[[TranscriptSegment], Awaitable[None]]


class SttSession(Protocol):
    async def send(self, chunk: bytes, sequence: int) -> None: ...
    async def close(self) -> None: ...


class SttAdapter(Protocol):
    name: str
    async def connect(self, session_id: str, emit: TranscriptSink) -> SttSession: ...


class RecordedSttSession:
    def __init__(self, segments: list[dict], emit: TranscriptSink):
        self._segments = segments
        self._index = 0
        self._emit = emit
        self._closed = False

    async def send(self, chunk: bytes, sequence: int) -> None:
        if self._closed:
            raise RuntimeError("STT session is closed")
        if not chunk:
            raise ValueError("audio chunk cannot be empty")
        while self._index < len(self._segments) and sequence >= self._segments[self._index].get("emit_after_sequence", 0):
            item = self._segments[self._index]
            self._index += 1
            await self._emit(TranscriptSegment.model_validate(item["segment"]))

    async def close(self) -> None:
        self._closed = True


class RecordedSttAdapter:
    name = "recorded"

    def __init__(self, fixture: Path | None = None):
        self.fixture = fixture or ROOT / "fixtures/hero-demo/phase2-transcript.json"

    async def connect(self, session_id: str, emit: TranscriptSink) -> RecordedSttSession:
        data = json.loads(self.fixture.read_text())
        return RecordedSttSession(data["events"], emit)


class DeepgramSttSession:
    def __init__(self, socket, emit: TranscriptSink):
        self._socket = socket
        self._emit = emit
        self._speakers = SpeakerMapper()
        self._count = 0
        self._receiver = asyncio.create_task(self._receive())

    async def send(self, chunk: bytes, sequence: int) -> None:
        if not chunk:
            raise ValueError("audio chunk cannot be empty")
        try:
            await self._socket.send(chunk)
        except Exception as error:
            raise ValueError("stt_unavailable") from error

    async def close(self) -> None:
        with suppress(Exception):
            await self._socket.send('{"type": "CloseStream"}')
            await asyncio.wait_for(self._receiver, timeout=5)
        with suppress(Exception):
            await self._socket.close()
        self._receiver.cancel()

    async def _receive(self) -> None:
        with suppress(Exception):
            async for message in self._socket:
                if isinstance(message, (bytes, bytearray)):
                    continue
                data = json.loads(message)
                if data.get("type") != "Results" or not data.get("is_final"):
                    continue
                alternative = ((data.get("channel") or {}).get("alternatives") or [{}])[0]
                text = normalize_text(str(alternative.get("transcript") or ""))
                if not text:
                    continue
                words = alternative.get("words") or [{}]
                start_ms = round(float(data.get("start") or 0) * 1000)
                self._count += 1
                await self._emit(
                    TranscriptSegment(
                        segment_id=f"dg-{self._count}",
                        speaker=self._speaker(str(words[0].get("speaker", 0))),
                        text=text,
                        start_ms=start_ms,
                        end_ms=start_ms + round(float(data.get("duration") or 0) * 1000),
                    )
                )

    def _speaker(self, label: str) -> str:
        # The transcript schema is two-speaker; extra diarized voices fold into A.
        try:
            return self._speakers.map(label)
        except ValueError:
            return "A"


class DeepgramSttAdapter:
    """Streams containerized tab audio to Deepgram live transcription."""

    name = "deepgram"

    def __init__(self, api_key: str, model: str = "nova-3", connector=None):
        self.api_key = api_key
        self.model = model
        self.connector = connector

    async def connect(self, session_id: str, emit: TranscriptSink) -> DeepgramSttSession:
        connector = self.connector
        if connector is None:
            from websockets.asyncio.client import connect as connector
        query = urlencode({"model": self.model, "smart_format": "true", "diarize": "true"})
        try:
            socket = await connector(
                f"wss://api.deepgram.com/v1/listen?{query}",
                additional_headers={"authorization": f"Token {self.api_key}"},
            )
        except Exception as error:
            raise ValueError("stt_unavailable") from error
        return DeepgramSttSession(socket, emit)


class FallbackSttAdapter:
    """Prefers the primary provider and degrades to the disclosed recorded fixture.

    The adapter name reflects the last connect outcome so claims created after a
    fallback carry fixture_mode=True and /readyz reports the degraded provider.
    """

    def __init__(self, primary: SttAdapter, backup: SttAdapter):
        self.primary = primary
        self.backup = backup
        self.name = primary.name

    async def connect(self, session_id: str, emit: TranscriptSink) -> SttSession:
        try:
            session = await self.primary.connect(session_id, emit)
            self.name = self.primary.name
        except ValueError:
            session = await self.backup.connect(session_id, emit)
            self.name = self.backup.name
        return session


class ProviderEventNormalizer:
    """Keeps provider labels and event shapes behind the STT adapter boundary."""

    def __init__(self):
        self.speakers = SpeakerMapper()

    def final_segment(
        self, provider_id: str, provider_speaker: str, text: str, start_ms: int, end_ms: int
    ) -> TranscriptSegment:
        return TranscriptSegment(
            segment_id=provider_id,
            speaker=self.speakers.map(provider_speaker),
            text=normalize_text(text),
            start_ms=start_ms,
            end_ms=end_ms,
        )


class FastClassifier(Protocol):
    name: str
    async def classify(self, candidate: ClaimCandidate) -> ClassificationResult: ...


class RecordedFastClassifier:
    """Credential-free deterministic classifier for CI and disclosed fallback."""

    name = "recorded"

    async def classify(self, candidate: ClaimCandidate) -> ClassificationResult:
        await asyncio.sleep(0)
        text = candidate.normalized_text.casefold()
        if "electric vehicles produce no carbon emissions" in text:
            return ClassificationResult(
                candidate_id=candidate.candidate_id,
                classification=Classification.factual_claim,
                normalized_claim="Electric vehicles produce no carbon emissions",
                neutral_queries=["electric vehicle lifecycle carbon emissions"],
                support_queries=["electric vehicle zero direct tailpipe emissions"],
                counter_queries=["electric vehicle battery lifecycle manufacturing emissions"],
            )
        if text.startswith(("i think", "i believe", "in my opinion")):
            classification = Classification.opinion
        else:
            classification = Classification.unverifiable
        return ClassificationResult(candidate_id=candidate.candidate_id, classification=classification)


CLASSIFICATION_PROMPT = """Classify one transcript sentence as opinion, factual_claim, or unverifiable. Do not judge truth. For factual_claim only, return normalized_claim and 1-3 neutral_queries, support_queries, and counter_queries. Return JSON only."""


class OpenAICompatibleFastClassifier:
    """Team-key fallback. The key remains process-local and errors are sanitized."""

    name = "openai-compatible"

    def __init__(self, base_url: str, api_key: str, model: str, timeout: float = 3.5):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    async def classify(self, candidate: ClaimCandidate) -> ClassificationResult:
        body = await asyncio.to_thread(self._request, candidate)
        try:
            content = body["choices"][0]["message"]["content"]
            value = json.loads(content)
            return ClassificationResult.model_validate(
                {
                    **value,
                    "candidate_id": candidate.candidate_id,
                    "provider": self.name,
                    "model": self.model,
                    "prompt_version": "phase2-v1",
                }
            )
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
            raise ValueError("provider returned an invalid classification") from error

    def _request(self, candidate: ClaimCandidate) -> dict:
        payload = json.dumps(
            {
                "model": self.model,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": CLASSIFICATION_PROMPT},
                    {"role": "user", "content": candidate.model_dump_json()},
                ],
            }
        ).encode()
        request = Request(
            f"{self.base_url}/v1/chat/completions",
            data=payload,
            headers={"authorization": f"Bearer {self.api_key}", "content-type": "application/json"},
            method="POST",
        )
        for attempt in range(2):
            try:
                with urlopen(request, timeout=self.timeout) as response:
                    raw = response.read(65_537)
                if len(raw) > 65_536:
                    raise ValueError("provider response exceeded size limit")
                return json.loads(raw)
            except HTTPError as error:
                if attempt == 0 and error.code >= 500:
                    continue
                raise ValueError(f"provider_http_{error.code}") from error
            except (TimeoutError, URLError) as error:
                if attempt == 0:
                    continue
                raise ValueError("provider_unavailable") from error
        raise ValueError("provider_unavailable")


def configured_stt() -> SttAdapter:
    api_key = os.getenv("VERITY_STT_API_KEY")
    if not api_key or os.getenv("VERITY_STT") == "recorded":
        return RecordedSttAdapter()
    return FallbackSttAdapter(
        DeepgramSttAdapter(api_key, os.getenv("VERITY_STT_MODEL", "nova-3")),
        RecordedSttAdapter(),
    )


def configured_fast_classifier() -> FastClassifier:
    values = [os.getenv("VERITY_FAST_BASE_URL"), os.getenv("VERITY_FAST_API_KEY"), os.getenv("VERITY_FAST_MODEL")]
    if all(values):
        return OpenAICompatibleFastClassifier(values[0], values[1], values[2])  # type: ignore[arg-type]
    return RecordedFastClassifier()
