#!/usr/bin/env python3
"""Dependency-free Phase 0 measurement, redaction, and validation harness."""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import re
import sys
import uuid
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
ALLOWED_BOUNDARIES = {"baseline", "tab_capture", "stt", "byok_digitalocean", "byok_openai_compatible", "iphone_push", "fallback"}
ALLOWED_STATUSES = {"not_run", "in_progress", "passed", "failed", "blocked"}
SECRET_KEYS = re.compile(r"(?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|subscription[_-]?(?:endpoint|key)|push[_-]?endpoint|audio[_-]?(?:bytes|data)|raw[_-]?(?:audio|body|request|response))", re.I)
SECRET_VALUES = [
    re.compile(r"\bBearer\s+[A-Za-z0-9._~+/=-]{8,}", re.I),
    re.compile(r"\bsk-[A-Za-z0-9_-]{12,}"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
]
REDACTED = "[REDACTED]"


class ValidationError(ValueError):
    pass


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def dump_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2, sort_keys=False)
        handle.write("\n")


def redact(value: Any, key: str = "") -> Any:
    if SECRET_KEYS.search(key):
        return REDACTED
    if isinstance(value, dict):
        return {k: redact(v, str(k)) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, str):
        result = value
        for pattern in SECRET_VALUES:
            result = pattern.sub(REDACTED, result)
        return result
    return value


def secret_findings(value: Any, path: str = "$") -> list[str]:
    findings: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            child = f"{path}.{key}"
            if SECRET_KEYS.search(str(key)) and item not in (None, "", False, REDACTED):
                findings.append(child)
            findings.extend(secret_findings(item, child))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            findings.extend(secret_findings(item, f"{path}[{index}]"))
    elif isinstance(value, str) and any(pattern.search(value) for pattern in SECRET_VALUES):
        findings.append(path)
    return findings


def parse_timestamp(value: str | None, field: str) -> dt.datetime | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be null or an RFC 3339 string")
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidationError(f"{field} is not RFC 3339") from exc
    if parsed.tzinfo is None:
        raise ValidationError(f"{field} must include a timezone")
    return parsed


def latency_ms(start: str | None, end: str | None) -> int | None:
    first = parse_timestamp(start, "start")
    second = parse_timestamp(end, "end")
    if first is None or second is None:
        return None
    value = int((second - first).total_seconds() * 1000)
    if value < 0:
        raise ValidationError("latency cannot be negative")
    return value


def analyze_sequences(sequence_numbers: list[int]) -> dict[str, Any]:
    if any(isinstance(item, bool) or not isinstance(item, int) or item < 0 for item in sequence_numbers):
        raise ValidationError("sequence numbers must be non-negative integers")
    duplicates = sorted({item for item in sequence_numbers if sequence_numbers.count(item) > 1})
    seen: set[int] = set()
    out_of_order: list[int] = []
    highest = -1
    for item in sequence_numbers:
        if item not in seen and item < highest:
            out_of_order.append(item)
        seen.add(item)
        highest = max(highest, item)
    missing = [] if not sequence_numbers else sorted(set(range(min(sequence_numbers), max(sequence_numbers) + 1)) - set(sequence_numbers))
    return {"count": len(sequence_numbers), "first": sequence_numbers[0] if sequence_numbers else None, "last": sequence_numbers[-1] if sequence_numbers else None, "duplicates": duplicates, "missing": missing, "out_of_order": out_of_order}


def validate_run(data: Any) -> None:
    if not isinstance(data, dict):
        raise ValidationError("run must be an object")
    required = {"schema_version", "artifact_kind", "run_id", "boundary", "status", "owner", "started_at", "ended_at", "environment", "timestamps", "measurements", "failure_mode", "pass_criteria_checked", "notes", "evidence_files"}
    missing = sorted(required - data.keys())
    if missing:
        raise ValidationError(f"run missing fields: {', '.join(missing)}")
    if data["schema_version"] != 1 or data["artifact_kind"] != "phase0_run":
        raise ValidationError("unsupported run schema")
    if data["boundary"] not in ALLOWED_BOUNDARIES:
        raise ValidationError("invalid boundary")
    if data["status"] not in ALLOWED_STATUSES:
        raise ValidationError("invalid status")
    started = parse_timestamp(data["started_at"], "started_at")
    ended = parse_timestamp(data["ended_at"], "ended_at")
    if started and ended and ended < started:
        raise ValidationError("ended_at precedes started_at")
    for name, value in data["timestamps"].items():
        parse_timestamp(value, f"timestamps.{name}")
    if not isinstance(data["pass_criteria_checked"], list) or not isinstance(data["evidence_files"], list):
        raise ValidationError("criteria and evidence_files must be arrays")
    if data["status"] == "passed" and (not data["evidence_files"] or not data["pass_criteria_checked"] or ended is None):
        raise ValidationError("passed runs require end time, checked criteria, and evidence")
    findings = secret_findings(data)
    if findings:
        raise ValidationError("secret-like content at " + ", ".join(findings))


def validate_fixture(data: Any, path: Path) -> None:
    if not isinstance(data, dict) or data.get("schema_version") != 1:
        raise ValidationError("fixture must be a schema_version 1 object")
    if data.get("fixture_status") not in {"placeholder_not_measured", "reviewed_disclosed_fixture"}:
        raise ValidationError("invalid fixture_status")
    if data.get("fixture_status") == "placeholder_not_measured" and data.get("measured") is not False:
        raise ValidationError("placeholder fixtures must set measured=false")
    if data.get("fixture_status") == "placeholder_not_measured" and data.get("gate_status") == "passed":
        raise ValidationError("placeholder fixture cannot pass a gate")
    findings = secret_findings(data)
    if findings:
        raise ValidationError("secret-like content at " + ", ".join(findings))
    if path.name == "inventory.json":
        required = {"transcript", "classification", "evidence", "verdict", "push"}
        names = {item.get("checkpoint") for item in data.get("checkpoints", []) if isinstance(item, dict)}
        if names != required:
            raise ValidationError("inventory must list exactly the five fallback checkpoints")


def validate_schema(data: Any) -> None:
    if not isinstance(data, dict) or "$schema" not in data or "$id" not in data or data.get("type") != "object":
        raise ValidationError("schema requires $schema, $id, and object type")


def validate_tree(include_results: bool = False) -> list[str]:
    paths = sorted((ROOT / "templates").glob("*.json")) + sorted((ROOT / "schemas").glob("*.json")) + sorted((ROOT / "fixtures" / "hero-demo").glob("*.json"))
    if include_results:
        paths += sorted((ROOT / "results").glob("*.json"))
    errors: list[str] = []
    for path in paths:
        try:
            data = load_json(path)
            if path.parent.name == "schemas":
                validate_schema(data)
            elif path.parent.name == "hero-demo":
                validate_fixture(data, path)
            elif path.name == "run.example.json" or path.parent.name == "results":
                validate_run(data)
            elif secret_findings(data):
                raise ValidationError("secret-like content found")
        except (OSError, json.JSONDecodeError, ValidationError) as exc:
            errors.append(f"{path.relative_to(ROOT)}: {exc}")
    if not paths:
        errors.append("no artifacts found")
    manifest_path = ROOT / "probes" / "extension" / "manifest.json"
    try:
        manifest = load_json(manifest_path)
        expected_hosts = [
            "https://www.youtube.com/*",
            "https://inference.do-ai.run/*",
            "https://api.openai.com/*",
        ]
        if manifest.get("minimum_chrome_version") != "116":
            raise ValidationError("minimum Chrome must remain 116")
        if manifest.get("host_permissions") != expected_hosts:
            raise ValidationError("host permissions must match the two checked-in BYOK candidates")
    except (OSError, json.JSONDecodeError, ValidationError) as exc:
        errors.append(f"{manifest_path.relative_to(ROOT)}: {exc}")
    for path in sorted((ROOT / "probes").rglob("*.js")) + sorted((ROOT / "probes").rglob("*.mjs")):
        try:
            content = path.read_text(encoding="utf-8")
            if re.search(r"\buseEffect\s*\(", content):
                raise ValidationError("direct useEffect is forbidden")
            if any(pattern.search(content) for pattern in SECRET_VALUES):
                raise ValidationError("secret-like value found")
        except (OSError, ValidationError) as exc:
            errors.append(f"{path.relative_to(ROOT)}: {exc}")
    return errors


def summarize_run(data: dict[str, Any]) -> dict[str, Any]:
    validate_run(data)
    stamps = data["timestamps"]
    summary = {
        "run_id": data["run_id"], "boundary": data["boundary"], "status": data["status"],
        "durations_ms": {
            "capture_to_first_chunk": latency_ms(stamps.get("capture_start"), stamps.get("first_audio_chunk")),
            "claim_to_first_final_transcript": latency_ms(stamps.get("claim_sentence_finalized"), stamps.get("first_final_transcript")),
            "push_send_to_receive": latency_ms(stamps.get("push_sent"), stamps.get("push_received")),
            "push_receive_to_open": latency_ms(stamps.get("push_received"), stamps.get("notification_opened")),
        },
    }
    sequences = data.get("measurements", {}).get("sequence_numbers")
    if sequences is not None:
        summary["sequence_analysis"] = analyze_sequences(sequences)
    return summary


def percentile(values: list[float], quantile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(len(ordered) * quantile + 0.999999) - 1))
    return ordered[index]


def summarize_event_log(path: Path) -> dict[str, Any]:
    events: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValidationError(f"event log line {line_number} is invalid JSON") from exc
            if not isinstance(event, dict) or not isinstance(event.get("event"), str):
                raise ValidationError(f"event log line {line_number} lacks an event")
            if secret_findings(event):
                raise ValidationError(f"event log line {line_number} contains secret-like data")
            events.append(event)
    chunks = [event for event in events if event["event"] == "audio_chunk"]
    sequences = [event.get("sequence") for event in chunks]
    analysis = analyze_sequences(sequences)
    drifts = [float(event["drift_ms"]) for event in chunks if isinstance(event.get("drift_ms"), (int, float))]
    stop = next((event for event in reversed(events) if event["event"] == "capture_stopped"), None)
    return {
        "source": path.name,
        "event_count": len(events),
        "sequence_analysis": analysis,
        "drift_ms": {
            "min": min(drifts) if drifts else None,
            "p50": percentile(drifts, 0.5),
            "p95": percentile(drifts, 0.95),
            "max": max(drifts) if drifts else None,
        },
        "transport_connections": sum(event["event"] == "transport_connected" for event in events),
        "duplicate_retransmissions_ignored": sum(event["event"] == "duplicate_chunk_ignored" for event in events),
        "clean_stop": bool(stop and stop.get("resources_released") is True),
    }


def command_new_run(args: argparse.Namespace) -> int:
    if args.boundary not in ALLOWED_BOUNDARIES:
        raise ValidationError("unsupported boundary")
    template = load_json(ROOT / "templates" / "run.example.json")
    now = dt.datetime.now(dt.timezone.utc)
    run_id = f"{args.boundary}-{now:%Y%m%dT%H%M%SZ}-{uuid.uuid4().hex[:8]}"
    template.update({"run_id": run_id, "boundary": args.boundary, "owner": args.owner})
    destination = ROOT / "results" / f"{run_id}.json"
    dump_json(destination, template)
    print(destination)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    validate_parser = sub.add_parser("validate")
    validate_parser.add_argument("--include-results", action="store_true")
    new_parser = sub.add_parser("new-run")
    new_parser.add_argument("--boundary", required=True)
    new_parser.add_argument("--owner", required=True)
    summary_parser = sub.add_parser("summarize")
    summary_parser.add_argument("path", type=Path)
    log_summary_parser = sub.add_parser("summarize-log")
    log_summary_parser.add_argument("path", type=Path)
    redact_parser = sub.add_parser("redact")
    redact_parser.add_argument("input", type=Path)
    redact_parser.add_argument("output", type=Path)
    args = parser.parse_args(argv)
    try:
        if args.command == "validate":
            errors = validate_tree(args.include_results)
            if errors:
                print("\n".join(errors), file=sys.stderr)
                return 1
            print("Phase 0 local artifacts valid; no provider/device gates were evaluated.")
            return 0
        if args.command == "new-run":
            return command_new_run(args)
        if args.command == "summarize":
            print(json.dumps(summarize_run(load_json(args.path)), indent=2))
            return 0
        if args.command == "summarize-log":
            print(json.dumps(summarize_event_log(args.path), indent=2))
            return 0
        dump_json(args.output, redact(load_json(args.input)))
        print(args.output)
        return 0
    except (OSError, json.JSONDecodeError, ValidationError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
