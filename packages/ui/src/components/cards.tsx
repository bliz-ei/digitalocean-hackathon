import type {Claim} from "@verity/contracts";
import {VerdictBadge} from "./VerdictBadge";
import {ConfidenceMeter} from "./ConfidenceMeter";
import {CitationCard} from "./CitationCard";

const terminal=new Set(["COMPLETE","INSUFFICIENT_EVIDENCE","FAILED"]);
const stateLabels:Record<string,string>={
  CAPTURING:"Listening",
  TRANSCRIBING:"Transcribing",
  CLAIM_CANDIDATE:"Claim detected",
  CHECKING:"Verity is checking…",
  EVIDENCE_READY:"Evidence ready",
  SYNTHESIZING:"Reviewing evidence",
  COMPLETE:"Verdict complete",
  INSUFFICIENT_EVIDENCE:"Insufficient evidence",
  FAILED:"Could not verify"
};

export function StatusCard({state,body}:{state:string;body?:string}){
  return <section className="vy-status-card" role="status">
    <span className="vy-status-card__eyebrow">Verity</span>
    <span className="vy-status-card__title">{stateLabels[state]??state}</span>
    {body&&<span className="vy-status-card__body">{body}</span>}
  </section>;
}

export function VerdictCard({claim}:{claim:Claim}){
  const verdict=claim.verdict;
  const sources=verdict?claim.evidence.filter(item=>verdict.citation_ids.includes(item.id)):[];
  return <article className="vy-verdict-card" aria-live="polite">
    <header className="vy-verdict-card__head">
      <span className="vy-verdict-card__eyebrow">{claim.fixture_mode?"Disclosed fixture mode":"Live evidence check"}</span>
      <div className="vy-verdict-card__topline">
        {verdict?<VerdictBadge label={verdict.label}/>:<span className="vy-status-card__title">{stateLabels[claim.state]??claim.state}</span>}
      </div>
      <blockquote className="vy-verdict-card__claim">“{claim.exact_text}”</blockquote>
      <span className="vy-verdict-card__speaker">{claim.speaker_label} · <time>{(claim.start_ms/1000).toFixed(1)}s</time></span>
    </header>

    {!verdict&&terminal.has(claim.state)&&<p className="vy-status-card__body" role="status">Verity did not publish a factual verdict. Retry when the evidence providers are available.</p>}

    {verdict&&<>
      {/* Evidence zone — source material, visually distinct from interpretation (trust rule). */}
      <section className="vy-zone vy-zone--evidence" aria-label="Evidence">
        <span className="vy-zone__label">Evidence · {sources.length} source{sources.length===1?"":"s"}</span>
        {sources.length?<div className="vy-citations">{sources.map(item=><CitationCard key={item.id} evidence={item}/>)}</div>
          :<p className="vy-zone__block">No source met the citation gate.</p>}
      </section>

      {/* Interpretation zone — Verity's read, uncertainty, and common ground. */}
      <section className="vy-zone vy-zone--read" aria-label="Verity's read">
        <span className="vy-zone__label">Verity’s read</span>
        <ConfidenceMeter confidence={verdict.confidence}/>
        <div className="vy-zone__grid">
          <div className="vy-zone__block"><h4>Explanation</h4><p>{verdict.explanation}</p></div>
          <div className="vy-zone__block"><h4>Uncertainty</h4><p>{verdict.uncertainty}</p></div>
          <div className="vy-zone__block"><h4>Strongest counterevidence</h4><p>{verdict.counterevidence_summary}</p></div>
          {verdict.common_ground&&<div className="vy-zone__block"><h4>Common ground</h4><p>{verdict.common_ground}</p></div>}
        </div>
      </section>
    </>}
  </article>;
}
