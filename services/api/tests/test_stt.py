import asyncio
import json

import pytest

from app.providers.live import (
    DeepgramSttAdapter,
    DeepgramSttSession,
    FallbackSttAdapter,
    RecordedSttAdapter,
    RecordedSttSession,
    configured_stt,
)


class FakeSocket:
    def __init__(self, messages):
        self.messages = list(messages)
        self.sent = []
        self.closed = False

    async def send(self, data):
        if self.closed:
            raise RuntimeError("socket closed")
        self.sent.append(data)

    async def close(self):
        self.closed = True

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self.messages:
            raise StopAsyncIteration
        return self.messages.pop(0)


def connector_for(socket):
    async def connector(url, additional_headers):
        assert url.startswith("wss://api.deepgram.com/v1/listen?")
        assert "diarize=true" in url
        assert additional_headers["authorization"] == "Token secret"
        return socket

    return connector


def result(text, start, duration, speaker=0, final=True):
    words = [{"word": text.split()[0], "speaker": speaker}] if text else []
    return json.dumps(
        {
            "type": "Results",
            "is_final": final,
            "start": start,
            "duration": duration,
            "channel": {"alternatives": [{"transcript": text, "words": words}]},
        }
    )


def test_deepgram_session_normalizes_final_results():
    asyncio.run(deepgram_session_normalizes_final_results())


async def deepgram_session_normalizes_final_results():
    socket = FakeSocket(
        [
            result("Hello  there.", 0.0, 1.2, speaker=3),
            result("interim guess", 1.2, 0.4, final=False),
            result("", 1.6, 0.2),
            result("Solar is cheap now.", 2.0, 1.5, speaker=7),
            result("A third voice appears.", 4.0, 1.0, speaker=9),
            json.dumps({"type": "Metadata"}),
        ]
    )
    segments = []

    async def emit(segment):
        segments.append(segment)

    adapter = DeepgramSttAdapter("secret", connector=connector_for(socket))
    session = await adapter.connect("session", emit)
    await session.send(b"webm-bytes", 0)
    await session.close()
    assert b"webm-bytes" in socket.sent
    assert '{"type": "CloseStream"}' in socket.sent
    assert socket.closed
    assert [(item.speaker, item.text, item.start_ms, item.end_ms) for item in segments] == [
        ("A", "Hello there.", 0, 1200),
        ("B", "Solar is cheap now.", 2000, 3500),
        ("A", "A third voice appears.", 4000, 5000),
    ]
    assert all(item.segment_id.startswith("dg-") for item in segments)


def test_deepgram_send_rejects_empty_and_sanitizes_transport_errors():
    asyncio.run(deepgram_send_rejects_empty_and_sanitizes_transport_errors())


async def deepgram_send_rejects_empty_and_sanitizes_transport_errors():
    socket = FakeSocket([])
    adapter = DeepgramSttAdapter("secret", connector=connector_for(socket))
    session = await adapter.connect("session", lambda segment: None)
    with pytest.raises(ValueError):
        await session.send(b"", 0)
    await session.close()
    with pytest.raises(ValueError, match="stt_unavailable"):
        await session.send(b"late", 1)


def test_deepgram_connect_failure_is_sanitized():
    async def failing(url, additional_headers):
        raise OSError("connection refused by upstream")

    adapter = DeepgramSttAdapter("secret", connector=failing)
    with pytest.raises(ValueError, match="stt_unavailable"):
        asyncio.run(adapter.connect("session", lambda segment: None))


def test_fallback_adapter_degrades_to_recorded_when_primary_unavailable():
    asyncio.run(fallback_adapter_degrades_to_recorded_when_primary_unavailable())


async def fallback_adapter_degrades_to_recorded_when_primary_unavailable():
    async def failing(url, additional_headers):
        raise OSError("connection refused by upstream")

    adapter = FallbackSttAdapter(DeepgramSttAdapter("secret", connector=failing), RecordedSttAdapter())
    assert adapter.name == "deepgram"
    session = await adapter.connect("session", lambda segment: None)
    assert isinstance(session, RecordedSttSession)
    assert adapter.name == "recorded"


def test_fallback_adapter_prefers_the_primary_when_it_connects():
    asyncio.run(fallback_adapter_prefers_the_primary_when_it_connects())


async def fallback_adapter_prefers_the_primary_when_it_connects():
    socket = FakeSocket([])
    adapter = FallbackSttAdapter(DeepgramSttAdapter("secret", connector=connector_for(socket)), RecordedSttAdapter())
    session = await adapter.connect("session", lambda segment: None)
    assert isinstance(session, DeepgramSttSession)
    assert adapter.name == "deepgram"
    await session.close()


def test_configured_stt_selects_adapter_from_environment(monkeypatch):
    monkeypatch.delenv("VERITY_STT_API_KEY", raising=False)
    monkeypatch.delenv("VERITY_STT", raising=False)
    assert isinstance(configured_stt(), RecordedSttAdapter)
    monkeypatch.setenv("VERITY_STT_API_KEY", "secret")
    monkeypatch.setenv("VERITY_STT_MODEL", "nova-2")
    adapter = configured_stt()
    assert isinstance(adapter, FallbackSttAdapter)
    assert adapter.primary.model == "nova-2"
    assert isinstance(adapter.backup, RecordedSttAdapter)
    monkeypatch.setenv("VERITY_STT", "recorded")
    assert isinstance(configured_stt(), RecordedSttAdapter)
