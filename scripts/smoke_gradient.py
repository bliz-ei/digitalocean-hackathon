"""Fail deployment unless the live Gradient agent returns verified, independent evidence."""

import asyncio
import json
import os
import sys

from app.domain.evidence import credible_independent_count
from app.domain.models import Claim, ClaimState, ClassificationResult, utcnow
from app.providers.evidence import GradientEvidenceCollector, SafePageFetcher


def target_claim(attempt: int) -> Claim:
    return Claim(
        public_id=f"gradient-smoke-{attempt}",
        session_id="deployment-smoke",
        speaker_label="Speaker B",
        exact_text="Electric vehicles produce no carbon emissions.",
        normalized_text="Electric vehicles produce no carbon emissions",
        start_ms=0,
        end_ms=1,
        classification="factual_claim",
        state=ClaimState.CHECKING,
        created_at=utcnow(),
        fixture_mode=False,
    )


def target_classification() -> ClassificationResult:
    return ClassificationResult(
        candidate_id="gradient-smoke",
        classification="factual_claim",
        normalized_claim="Electric vehicles produce no carbon emissions",
        neutral_queries=["electric vehicle lifecycle emissions"],
        support_queries=["electric vehicle direct tailpipe emissions EPA"],
        counter_queries=["electric vehicle battery manufacturing lifecycle emissions ICCT"],
    )


async def run() -> None:
    endpoint = os.getenv("VERITY_GRADIENT_AGENT_ENDPOINT", "")
    api_key = os.getenv("VERITY_GRADIENT_AGENT_KEY", "")
    attempts = int(os.getenv("VERITY_GRADIENT_SMOKE_ATTEMPTS", "3"))
    if not endpoint.startswith("https://") or not api_key:
        raise ValueError("Gradient endpoint and key are required")
    if attempts < 1 or attempts > 5:
        raise ValueError("VERITY_GRADIENT_SMOKE_ATTEMPTS must be between 1 and 5")

    collector = GradientEvidenceCollector(endpoint, api_key, SafePageFetcher(), timeout=12)
    results = []
    for attempt in range(1, attempts + 1):
        records = await collector.collect(target_claim(attempt), target_classification())
        stances = {record.evidence.stance for record in records}
        independent = credible_independent_count(records)
        passed = independent >= 2 and {"support", "counter"}.issubset(stances)
        results.append({"attempt": attempt, "verified_evidence": len(records), "independent_sources": independent, "stances": sorted(stances), "passed": passed})
        if not passed:
            print(json.dumps({"gradient_smoke": results}, indent=2), file=sys.stderr)
            raise RuntimeError("Gradient smoke test did not return verified support and counterevidence from two independent sources")
    print(json.dumps({"gradient_smoke": results}, indent=2))


if __name__ == "__main__":
    asyncio.run(run())
