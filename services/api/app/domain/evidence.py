import hashlib
import ipaddress
import re
import socket
from collections.abc import Iterable
from dataclasses import dataclass
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.domain.models import (
    Claim,
    Evidence,
    EvidenceRecord,
    ExtractedPage,
    SearchResult,
    SearchRole,
    SourceTier,
    Stance,
    Verdict,
    VerdictDraft,
    VerdictLabel,
)


TRACKING_PARAMETERS = {"fbclid", "gclid", "mc_cid", "mc_eid"}
RESEARCH_DOMAINS = {"theicct.org", "nature.com", "science.org", "sciencedirect.com"}
ESTABLISHED_DOMAINS = {"who.int", "un.org", "oecd.org", "reuters.com", "apnews.com"}
BLOCKED_PORTS = {0, 22, 25, 3306, 5432, 6379, 9200}
WORD = re.compile(r"[a-z0-9]+")


class UnsafeUrl(ValueError):
    pass


def canonicalize_url(value: str) -> str:
    parsed = urlsplit(value.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise UnsafeUrl("only credential-free HTTP(S) URLs are supported")
    try:
        port = parsed.port
    except ValueError as error:
        raise UnsafeUrl("invalid port") from error
    if port in BLOCKED_PORTS or (port and port not in {80, 443}):
        raise UnsafeUrl("unsupported port")
    _reject_address(parsed.hostname)
    host = parsed.hostname.casefold().rstrip(".")
    netloc = host if port is None else f"{host}:{port}"
    path = re.sub(r"/{2,}", "/", parsed.path or "/")
    if path != "/":
        path = path.rstrip("/")
    query = urlencode(
        sorted(
            (key, item)
            for key, item in parse_qsl(parsed.query, keep_blank_values=True)
            if not key.casefold().startswith("utm_") and key.casefold() not in TRACKING_PARAMETERS
        )
    )
    return urlunsplit((parsed.scheme.casefold(), netloc, path, query, ""))


def assert_public_host(hostname: str) -> None:
    _reject_address(hostname)
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)}
    except socket.gaierror as error:
        raise UnsafeUrl("host could not be resolved") from error
    if not addresses:
        raise UnsafeUrl("host could not be resolved")
    for address in addresses:
        _reject_address(address)


def _reject_address(hostname: str) -> None:
    normalized = hostname.casefold().rstrip(".")
    if normalized == "localhost" or normalized.endswith(".localhost") or normalized.endswith(".local"):
        raise UnsafeUrl("local hosts are blocked")
    try:
        address = ipaddress.ip_address(normalized)
    except ValueError:
        return
    if not address.is_global:
        raise UnsafeUrl("private or non-global addresses are blocked")


def normalized_excerpt(value: str) -> str:
    return " ".join(value.split()).strip()


def excerpt_is_captured(excerpt: str, captured_text: str) -> bool:
    return normalized_excerpt(excerpt).casefold() in normalized_excerpt(captured_text).casefold()


def source_tier(url: str) -> SourceTier:
    host = (urlsplit(url).hostname or "").casefold()
    if host.endswith(".gov") or host in {"epa.gov", "energy.gov"}:
        return SourceTier.primary
    if any(host == domain or host.endswith(f".{domain}") for domain in RESEARCH_DOMAINS):
        return SourceTier.research
    if any(host == domain or host.endswith(f".{domain}") for domain in ESTABLISHED_DOMAINS):
        return SourceTier.established
    return SourceTier.other


def independent_key(publisher: str, url: str) -> str:
    host = (urlsplit(url).hostname or "").removeprefix("www.").casefold()
    publisher_key = "-".join(WORD.findall(publisher.casefold()))
    return publisher_key or host


def relevant_excerpt(claim: str, page: ExtractedPage, limit: int = 360) -> str:
    terms = set(WORD.findall(claim.casefold()))
    passages = [normalized_excerpt(item) for item in re.split(r"\n\s*\n|(?<=[.!?])\s+(?=[A-Z])", page.text)]
    passages = [item for item in passages if 30 <= len(item) <= 1_200]
    if not passages:
        raise ValueError("page has no extractable passage")
    passage = max(passages, key=lambda item: (len(terms & set(WORD.findall(item.casefold()))), -len(item)))
    return passage if len(passage) <= limit else passage[:limit].rsplit(" ", 1)[0].rstrip(" ,;:") + "…"


def build_evidence(claim: Claim, result: SearchResult, page: ExtractedPage) -> EvidenceRecord:
    excerpt = relevant_excerpt(claim.normalized_text, page)
    if not excerpt_is_captured(excerpt.removesuffix("…"), page.text):
        raise ValueError("selected excerpt is not present in captured page")
    stance = Stance.counter if result.role == SearchRole.counter else Stance.support if result.role == SearchRole.support else Stance.context
    digest = hashlib.sha256(f"{claim.public_id}\0{page.canonical_url}\0{excerpt}".encode()).hexdigest()
    evidence = Evidence(
        id=f"ev-{digest[:16]}",
        stance=stance,
        title=page.title,
        canonical_url=page.canonical_url,
        publisher=page.publisher,
        published_at=page.published_at,
        retrieved_at=page.retrieved_at,
        excerpt=excerpt,
        source_tier=source_tier(str(page.canonical_url)),
        content_hash=page.content_hash,
        query_role=result.role,
        independent_key=independent_key(page.publisher, str(page.canonical_url)),
    )
    return EvidenceRecord(evidence=evidence, captured_text=page.text)


def select_evidence(records: Iterable[EvidenceRecord], limit: int = 6) -> list[EvidenceRecord]:
    tiers = {SourceTier.primary: 4, SourceTier.research: 3, SourceTier.established: 2, SourceTier.other: 0}
    ordered = sorted(
        records,
        key=lambda item: (
            item.evidence.source_tier == SourceTier.other,
            -tiers[item.evidence.source_tier],
            item.evidence.query_role != SearchRole.counter,
            item.evidence.canonical_url.unicode_string(),
        ),
    )
    selected: list[EvidenceRecord] = []
    seen_urls: set[str] = set()
    seen_hashes: set[str] = set()
    for record in ordered:
        url = canonicalize_url(str(record.evidence.canonical_url))
        if url in seen_urls or record.evidence.content_hash in seen_hashes:
            continue
        seen_urls.add(url)
        seen_hashes.add(record.evidence.content_hash)
        selected.append(record)
        if len(selected) == limit:
            break
    return selected


def credible_independent_count(records: Iterable[EvidenceRecord]) -> int:
    return len(
        {
            item.evidence.independent_key
            for item in records
            if item.evidence.source_tier != SourceTier.other
        }
    )


@dataclass(frozen=True)
class ValidationResult:
    verdict: Verdict | None
    errors: tuple[str, ...]


def validate_draft(claim: Claim, records: list[EvidenceRecord], draft: VerdictDraft) -> ValidationResult:
    errors: list[str] = []
    by_id = {item.evidence.id: item for item in records}
    if draft.claim_public_id != claim.public_id:
        errors.append("claim_id_mismatch")
    if len(draft.citation_ids) != len(set(draft.citation_ids)):
        errors.append("duplicate_citation")
    cited = [by_id[item] for item in draft.citation_ids if item in by_id]
    if len(cited) != len(draft.citation_ids):
        errors.append("unknown_citation")
    if any(not excerpt_is_captured(item.evidence.excerpt.removesuffix("…"), item.captured_text) for item in cited):
        errors.append("excerpt_mismatch")
    independent = credible_independent_count(cited)
    if draft.label != VerdictLabel.InsufficientEvidence and not 2 <= len(cited) <= 3:
        errors.append("citation_count")
    if draft.label != VerdictLabel.InsufficientEvidence and independent < 2:
        errors.append("insufficient_independent_sources")
    has_support = any(item.evidence.stance in {Stance.support, Stance.context} for item in cited)
    has_counter = any(item.evidence.stance == Stance.counter for item in cited)
    if has_support and has_counter and draft.label in {VerdictLabel.Supported, VerdictLabel.Unsupported}:
        errors.append("credible_conflict_requires_disputed_or_misleading")
    if draft.confidence > 0.9 and _major_uncertainty(draft.uncertainty):
        errors.append("confidence_overstates_uncertainty")
    if cited and not _text_supported(draft.explanation, cited, threshold=0.3):
        errors.append("unsupported_explanation")
    if cited and not _text_supported(draft.counterevidence_summary, cited, threshold=0.3):
        errors.append("unsupported_counterevidence")
    common_ground = draft.common_ground
    if common_ground and not _text_supported(common_ground, cited):
        common_ground = None
    if errors:
        return ValidationResult(None, tuple(dict.fromkeys(errors)))
    return ValidationResult(
        Verdict(
            label=draft.label,
            confidence=round(draft.confidence, 2),
            explanation=draft.explanation.strip(),
            uncertainty=draft.uncertainty.strip(),
            counterevidence_summary=draft.counterevidence_summary.strip(),
            common_ground=common_ground.strip() if common_ground else None,
            citation_ids=draft.citation_ids,
            model_provider=draft.model_provider,
            model_name=draft.model_name,
            prompt_version=draft.prompt_version,
        ),
        (),
    )


def _major_uncertainty(value: str) -> bool:
    text = value.casefold()
    return any(term in text for term in ("major uncertainty", "materially disagree", "unknown", "insufficient"))


def _text_supported(value: str, records: list[EvidenceRecord], threshold: float = 0.45) -> bool:
    meaningful = {item for item in WORD.findall(value.casefold()) if len(item) > 3}
    corpus = set(WORD.findall(" ".join(item.evidence.excerpt for item in records).casefold()))
    return bool(meaningful) and len(meaningful & corpus) / len(meaningful) >= threshold
