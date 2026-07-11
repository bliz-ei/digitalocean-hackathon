import hashlib
import re
from collections import OrderedDict
from dataclasses import dataclass

from app.domain.models import ClaimCandidate, TranscriptSegment


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalized_claim(value: str) -> str:
    return normalize_text(value).casefold().rstrip(".!?")


def digest(*parts: object) -> str:
    raw = "\x1f".join(str(part) for part in parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


class AudioLedger:
    def __init__(self, max_buffered_chunks: int = 12):
        self.max_buffered_chunks = max_buffered_chunks
        self.watermark = -1
        self.pending: set[int] = set()

    def accept(self, sequence: int) -> tuple[bool, int]:
        if sequence <= self.watermark or sequence in self.pending:
            return False, self.watermark
        if sequence > self.watermark + self.max_buffered_chunks:
            raise ValueError("audio sequence exceeds replay window")
        self.pending.add(sequence)
        while self.watermark + 1 in self.pending:
            self.pending.remove(self.watermark + 1)
            self.watermark += 1
        return True, self.watermark


class SpeakerMapper:
    def __init__(self):
        self._labels: dict[str, str] = {}

    def map(self, provider_label: str) -> str:
        if provider_label not in self._labels:
            if len(self._labels) == 2:
                raise ValueError("Phase 2 supports exactly two speakers")
            self._labels[provider_label] = "AB"[len(self._labels)]
        return self._labels[provider_label]


@dataclass
class _Sentence:
    speaker: str
    parts: list[str]
    start_ms: int
    end_ms: int


class SentenceAssembler:
    def __init__(self, max_duration_ms: int = 20_000, max_chars: int = 500):
        self.max_duration_ms = max_duration_ms
        self.max_chars = max_chars
        self._current: _Sentence | None = None
        self._seen: set[str] = set()
        self._previous = ""

    def add(self, segment: TranscriptSegment) -> list[ClaimCandidate]:
        if not segment.is_final or segment.segment_id in self._seen:
            return []
        self._seen.add(segment.segment_id)
        emitted: list[ClaimCandidate] = []
        if self._current and self._current.speaker != segment.speaker:
            candidate = self._close()
            if candidate:
                emitted.append(candidate)
        if not self._current:
            self._current = _Sentence(segment.speaker, [], segment.start_ms, segment.end_ms)
        self._current.parts.append(normalize_text(segment.text))
        self._current.end_ms = segment.end_ms
        text = normalize_text(" ".join(self._current.parts))
        bounded = segment.end_ms - self._current.start_ms >= self.max_duration_ms or len(text) >= self.max_chars
        if re.search(r"[.!?][\"']?$", text) or bounded:
            candidate = self._close()
            if candidate:
                emitted.append(candidate)
        return emitted

    def flush(self) -> list[ClaimCandidate]:
        candidate = self._close()
        return [candidate] if candidate else []

    def _close(self) -> ClaimCandidate | None:
        current, self._current = self._current, None
        if not current:
            return None
        exact = normalize_text(" ".join(current.parts))
        words = exact.rstrip(".!?").split()
        if len(words) < 3:
            self._previous = exact
            return None
        candidate = ClaimCandidate(
            candidate_id=digest(current.speaker, current.start_ms, current.end_ms, normalize_text(exact).casefold()),
            speaker=current.speaker,
            exact_text=exact,
            normalized_text=normalize_text(exact),
            start_ms=current.start_ms,
            end_ms=current.end_ms,
            context_before=self._previous[-500:],
        )
        self._previous = exact
        return candidate


class ClaimDeduplicator:
    def __init__(self, window_ms: int = 60_000, capacity: int = 256):
        self.window_ms = window_ms
        self.capacity = capacity
        self._claims: OrderedDict[str, int] = OrderedDict()

    def accept(self, claim: str, at_ms: int) -> bool:
        key = normalized_claim(claim)
        previous = self._claims.get(key)
        if previous is not None and at_ms - previous <= self.window_ms:
            return False
        self._claims[key] = at_ms
        self._claims.move_to_end(key)
        while len(self._claims) > self.capacity:
            self._claims.popitem(last=False)
        return True
