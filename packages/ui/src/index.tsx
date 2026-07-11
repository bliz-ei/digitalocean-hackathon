import type {Claim,Evidence} from "@verity/contracts";
import "./tokens.css";

const terminal=new Set(["COMPLETE","INSUFFICIENT_EVIDENCE","FAILED"]);
const labels:Record<string,string>={
  COMPLETE:"Verdict complete",
  INSUFFICIENT_EVIDENCE:"Insufficient evidence",
  FAILED:"Check failed",
  EVIDENCE_READY:"Evidence ready",
  SYNTHESIZING:"Reviewing evidence",
};

export function VerdictCard({claim}:{claim:Claim}){
  const verdict=claim.verdict;
  const sources=verdict?claim.evidence.filter(item=>verdict.citation_ids.includes(item.id)):[];
  return <article className={`verity-card state-${claim.state.toLowerCase()}`} aria-live="polite">
    <header className="verity-header">
      <small>{claim.fixture_mode?"Demo evidence set":"Live evidence check"}</small>
      <h1>{verdict?.label??labels[claim.state]??claim.state}</h1>
    </header>
    <section aria-labelledby="verity-claim">
      <h2 id="verity-claim">Claim</h2>
      <blockquote>“{claim.exact_text}”</blockquote>
      <p className="source-meta">{claim.speaker_label} · <time>{(claim.start_ms/1000).toFixed(1)}s</time></p>
    </section>
    {!verdict&&terminal.has(claim.state)&&<p role="status">Verity did not publish a factual verdict. Retry when the evidence providers are available.</p>}
    {verdict&&<>
      <section className="interpretation" aria-labelledby="verity-interpretation">
        <h2 id="verity-interpretation">What the evidence says</h2>
        <p><strong>{Math.round(verdict.confidence*100)}% confidence.</strong> {verdict.explanation}</p>
      </section>
      <section className="trust-grid" aria-label="Limitations and counterevidence">
        <div><h2>Uncertainty</h2><p>{verdict.uncertainty}</p></div>
        <div><h2>Strongest counterevidence</h2><p>{verdict.counterevidence_summary}</p></div>
      </section>
      <section aria-labelledby="verity-sources">
        <h2 id="verity-sources">Sources</h2>
        {sources.length?<ol className="source-list">{sources.map(item=><Source key={item.id} evidence={item}/>)}</ol>:<p>No source met the citation gate.</p>}
      </section>
      {verdict.common_ground&&<section className="common-ground" aria-labelledby="verity-common-ground"><h2 id="verity-common-ground">Common ground</h2><p>{verdict.common_ground}</p></section>}
    </>}
  </article>;
}

function Source({evidence}:{evidence:Evidence}){
  const published=evidence.published_at?new Date(evidence.published_at).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}):"Date unavailable";
  return <li>
    <span className="stance">{evidence.stance}</span>
    <a href={evidence.canonical_url} target="_blank" rel="noopener noreferrer">{evidence.title}</a>
    <p className="source-meta">{evidence.publisher} · {published} · {evidence.source_tier}</p>
    <blockquote>{evidence.excerpt}</blockquote>
  </li>;
}

export function StatusCard({state}:{state:string}){
  return <header className="pwa-status" role="status" aria-live="polite"><span className="brand-mark" aria-hidden="true">V</span><div><small>Verity</small><h1>{labels[state]??state}</h1></div></header>;
}
