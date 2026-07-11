import type {Evidence} from "@verity/contracts";

const stanceLabel:Record<Evidence["stance"],{label:string;cls:string}>={
  support:{label:"Supports",cls:"vy-chip--supports"},
  context:{label:"Adds context",cls:"vy-chip--supports"},
  counter:{label:"Challenges",cls:"vy-chip--challenges"}
};

const tierLabel:Record<Evidence["source_tier"],string>={
  primary:"Tier 1 · Primary",
  research:"Tier 2 · Research",
  established:"Tier 2 · Established",
  other:"Tier 3 · Other"
};

function formatDate(value:string|null):string{
  if(!value)return "Date unavailable";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"Date unavailable":date.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
}

export function CitationCard({evidence}:{evidence:Evidence}){
  const stance=stanceLabel[evidence.stance];
  return <article className="vy-citation">
    <div className="vy-citation__chips">
      <span className={`vy-chip ${stance.cls}`}>{stance.label}</span>
      <span className="vy-chip vy-chip--tier">{tierLabel[evidence.source_tier]}</span>
    </div>
    <a className="vy-citation__title" href={evidence.canonical_url} target="_blank" rel="noopener noreferrer">{evidence.title}</a>
    <span className="vy-citation__meta">{evidence.publisher} · Published {formatDate(evidence.published_at)} · Retrieved {formatDate(evidence.retrieved_at)}</span>
    <a className="vy-citation__url" href={evidence.canonical_url} target="_blank" rel="noopener noreferrer">{evidence.canonical_url}</a>
    <blockquote className="vy-citation__excerpt">{evidence.excerpt}</blockquote>
  </article>;
}
