import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "harness.py"
SPEC = importlib.util.spec_from_file_location("phase0_harness", MODULE_PATH)
harness = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(harness)


class RedactionTests(unittest.TestCase):
    def test_redacts_secret_keys_recursively_without_mutation(self):
        source = {"safe": "ok", "nested": {"api_key": "secret"}, "authorization": "Bearer abcdefghijkl"}
        result = harness.redact(source)
        self.assertEqual(result["safe"], "ok")
        self.assertEqual(result["nested"]["api_key"], harness.REDACTED)
        self.assertEqual(result["authorization"], harness.REDACTED)
        self.assertEqual(source["nested"]["api_key"], "secret")

    def test_redacts_secret_patterns_in_free_text(self):
        result = harness.redact("failure: Bearer abcdefghijklmnop")
        self.assertEqual(result, "failure: [REDACTED]")

    def test_secret_scanner_reports_unsafe_values_but_allows_null_template_fields(self):
        self.assertEqual(harness.secret_findings({"api_key": None}), [])
        self.assertEqual(harness.secret_findings({"api_key": "live-secret"}), ["$.api_key"])


class MeasurementTests(unittest.TestCase):
    def test_latency_uses_timezone_aware_timestamps(self):
        self.assertEqual(harness.latency_ms("2026-01-01T00:00:00Z", "2026-01-01T00:00:01.250Z"), 1250)

    def test_negative_latency_fails(self):
        with self.assertRaises(harness.ValidationError):
            harness.latency_ms("2026-01-01T00:00:02Z", "2026-01-01T00:00:01Z")

    def test_sequence_analysis_is_observational(self):
        result = harness.analyze_sequences([10, 11, 11, 13, 12])
        self.assertEqual(result["duplicates"], [11])
        self.assertEqual(result["missing"], [])
        self.assertEqual(result["out_of_order"], [12])

    def test_event_log_summary_reports_reconnect_drift_and_clean_stop(self):
        events = [
            {"event": "transport_connected"},
            {"event": "audio_chunk", "sequence": 0, "drift_ms": 2.0},
            {"event": "transport_connected"},
            {"event": "audio_chunk", "sequence": 1, "drift_ms": 4.0},
            {"event": "capture_stopped", "resources_released": True},
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "events.jsonl"
            path.write_text("\n".join(json.dumps(event) for event in events), encoding="utf-8")
            summary = harness.summarize_event_log(path)
        self.assertEqual(summary["transport_connections"], 2)
        self.assertEqual(summary["drift_ms"]["p95"], 4.0)
        self.assertTrue(summary["clean_stop"])


class ValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.template = harness.load_json(harness.ROOT / "templates" / "run.example.json")

    def test_committed_tree_validates(self):
        self.assertEqual(harness.validate_tree(), [])

    def test_placeholder_cannot_claim_passed(self):
        fixture = {"schema_version": 1, "fixture_status": "placeholder_not_measured", "measured": False, "gate_status": "passed"}
        with self.assertRaises(harness.ValidationError):
            harness.validate_fixture(fixture, Path("fixture.json"))

    def test_passed_run_requires_evidence_end_time_and_criteria(self):
        run = copy.deepcopy(self.template)
        run["status"] = "passed"
        with self.assertRaises(harness.ValidationError):
            harness.validate_run(run)

    def test_valid_measured_run_summary(self):
        run = copy.deepcopy(self.template)
        run.update({"run_id": "synthetic-test", "status": "failed", "owner": "Tester", "started_at": "2026-01-01T00:00:00Z", "ended_at": "2026-01-01T00:00:03Z"})
        run["timestamps"]["capture_start"] = "2026-01-01T00:00:00Z"
        run["timestamps"]["first_audio_chunk"] = "2026-01-01T00:00:01Z"
        run["measurements"]["sequence_numbers"] = [0, 1, 3]
        harness.validate_run(run)
        summary = harness.summarize_run(run)
        self.assertEqual(summary["durations_ms"]["capture_to_first_chunk"], 1000)
        self.assertEqual(summary["sequence_analysis"]["missing"], [2])

    def test_redact_command_round_trip(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "input.json"
            target = Path(directory) / "output.json"
            source.write_text(json.dumps({"api_key": "do-not-keep", "status": "failed"}), encoding="utf-8")
            self.assertEqual(harness.main(["redact", str(source), str(target)]), 0)
            self.assertEqual(json.loads(target.read_text(encoding="utf-8"))["api_key"], harness.REDACTED)


if __name__ == "__main__":
    unittest.main()
