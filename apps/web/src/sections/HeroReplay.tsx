import {useEffect, useMemo, useRef, useState} from "react";
import type {Claim, TranscriptSegment} from "@verity/contracts";
import {
  PaletteCard, PaletteRow, StatusChip, StatusCard, VerdictBadge, confidenceBand,
  heroTimeline, heroClaim, replayTimeline, type HeroEnvelope, type StatusState
} from "@verity/ui";

type ReplayState={transcripts:TranscriptSegment[];claim:Claim|null};

const FROZEN_TRANSCRIPTS=heroTimeline
  .filter(event=>event.envelope.type==="transcript_final")
  .map(event=>event.envelope.payload as TranscriptSegment);

function reduce(prev:ReplayState,env:HeroEnvelope):ReplayState{
  if(env.type==="transcript_final"){
    const seg=env.payload as TranscriptSegment;
    // The first line (hero-1) marks the top of a fresh loop — reset accumulators.
    return seg.segment_id==="hero-1"
      ? {transcripts:[seg],claim:null}
      : {transcripts:[...prev.transcripts,seg],claim:prev.claim};
  }
  const claim=(env.payload as {claim:Claim}).claim;
  return {transcripts:prev.transcripts,claim};
}

function statusFor({transcripts,claim}:ReplayState):StatusState{
  if(!claim)return transcripts.length?"Transcribing":"Listening";
  switch(claim.state){
    case "CHECKING":
    case "EVIDENCE_READY":
    case "SYNTHESIZING":return "Checking";
    case "COMPLETE":return "Completed";
    case "FAILED":
    case "INSUFFICIENT_EVIDENCE":return "Could not verify";
    default:return "Transcribing";
  }
}

function prefersReducedMotion():boolean{
  return typeof window!=="undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches===true;
}

/** One frame of the overlay body: the transcript palette plus the checking panel or
 *  the resolved verdict. Rendered twice — an invisible ghost fixed to the tallest
 *  (completed) frame to reserve height, and the live animating layer on top — so the
 *  mock never reflows as rows and the verdict stream in. */
function Frame({transcripts,claim}:ReplayState){
  const verdict=claim?.verdict??null;
  const isCandidate=!!claim && claim.state!=="COMPLETE";
  const sources=verdict?claim!.evidence.filter(item=>verdict.citation_ids.includes(item.id)):[];
  return (
    <div className="web-mock__frame">
      <PaletteCard dots title="youtube.com/watch — live debate">
        {transcripts.map(seg=>{
          const flagged=!!claim && seg.text===claim.exact_text;
          return (
            <PaletteRow
              key={seg.segment_id}
              active={flagged && isCandidate}
              icon={<span className={`web-spk web-spk--${seg.speaker.toLowerCase()}`}>{seg.speaker}</span>}
              label={seg.text}
              keycap={flagged?<span className="web-mock__flag">Factual claim</span>:undefined}
            />
          );
        })}
      </PaletteCard>

      {claim && !verdict && (
        <div className="web-mock__panel">
          <StatusCard state={claim.state}/>
        </div>
      )}

      {verdict && (
        <article className="web-mock__verdict">
          <div className="web-mock__verdicthead">
            <VerdictBadge label={verdict.label}/>
            <span className="web-mock__conf">{confidenceBand(verdict.confidence)} confidence</span>
          </div>
          <p className="web-mock__why">{verdict.explanation}</p>
          <div className="web-mock__sources">
            <span className="web-mock__sourceslabel">{sources.length} sources</span>
            {sources.map(item=><span key={item.id} className="web-mock__source">{item.publisher}</span>)}
          </div>
        </article>
      )}
    </div>
  );
}

/** The hero overlay mockup, rebuilt from @verity/ui parts and driven by
 *  replayTimeline(heroTimeline, …, {loop:true}). Transcript lines stream in, the
 *  factual claim is flagged, "Verity is checking…" shows, then the Misleading
 *  verdict resolves; the loop holds and restarts. Under prefers-reduced-motion we
 *  render the frozen completed-verdict frame with no timers. */
export function HeroReplay(){
  const reduced=useMemo(prefersReducedMotion,[]);
  const [state,setState]=useState<ReplayState>(()=>reduced
    ? {transcripts:FROZEN_TRANSCRIPTS,claim:heroClaim}
    : {transcripts:[],claim:null});
  const stateRef=useRef(state);
  stateRef.current=state;

  useEffect(()=>{
    if(reduced)return;
    const cancel=replayTimeline(heroTimeline,(env:HeroEnvelope)=>{
      setState(reduce(stateRef.current,env));
    },{loop:true});
    return cancel;
  },[reduced]);

  const status=statusFor(state);

  return (
    <div className="web-mock" aria-label="Verity overlay demo">
      <div className="web-mock__bar">
        <span className="web-mock__tag">Verity overlay</span>
        <StatusChip state={status}/>
      </div>

      <div className="web-mock__stage">
        {/* Ghost: the tallest (completed) frame, invisible, reserves the stage height
            at every width so the live layer below can animate without reflow. */}
        <div className="web-mock__ghost" aria-hidden="true">
          <Frame transcripts={FROZEN_TRANSCRIPTS} claim={heroClaim}/>
        </div>
        <div className="web-mock__layer">
          <Frame transcripts={state.transcripts} claim={state.claim}/>
        </div>
      </div>
    </div>
  );
}
