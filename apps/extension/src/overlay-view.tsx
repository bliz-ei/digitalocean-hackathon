import React from "react";
import type {Claim,TranscriptSegment} from "@verity/contracts";
import {StatusChip,VerityMark,VerdictBadge,VerdictCard,type StatusState} from "@verity/ui";

/* Pure display layer for the YouTube overlay. No chrome.* access and no side effects
 * on import, so the dev harness can mount it directly. content-script.tsx owns the
 * Shadow DOM host, the WebSocket/event wiring, and re-renders <Overlay/> on each
 * OVERLAY_STATE broadcast — this file only maps that state to the palette UI. */

export type OverlayState={mode:"fixture"|"live";connection:string;transcripts:TranscriptSegment[];sessionId?:string;pairingCode?:string;redemptionToken?:string;pairingExpiresAt?:string;claim?:Claim;error?:string};

const terminalStates=new Set(["COMPLETE","INSUFFICIENT_EVIDENCE","FAILED"]);
const checkingStates=new Set(["CLAIM_CANDIDATE","CHECKING","EVIDENCE_READY","SYNTHESIZING"]);

/** Map the persisted OverlayState onto the five locked StatusChip states (DESIGN.md §7). */
export function deriveStatus(state?:OverlayState):StatusState{
  if(!state)return "Idle";
  const claimState=state.claim?.state;
  if(state.error||claimState==="FAILED"||state.connection==="ERROR"||state.connection==="FAILED")return "Could not verify";
  if(state.claim?.verdict||claimState==="COMPLETE"||claimState==="INSUFFICIENT_EVIDENCE")return "Completed";
  if(claimState&&checkingStates.has(claimState))return "Checking";
  if(state.transcripts?.length)return "Transcribing";
  return "Listening";
}

function claimIsComplete(claim:Claim):boolean{
  return Boolean(claim.verdict)||terminalStates.has(claim.state);
}

/** Card styles shared by the real Shadow-DOM overlay and the dev harness. Every value
 *  references a design token; the outer card reuses the `.vy-palette` chrome. */
export const overlayCss=`
.vy-ov-card{width:100%;box-sizing:border-box;font-family:var(--font-sans);font-feature-settings:var(--font-feature-body);color:var(--color-body)}
.vy-ov__head{display:flex;align-items:center;gap:var(--space-sm);padding:var(--space-md) var(--space-lg);border-bottom:1px solid var(--color-hairline)}
.vy-ov__head-spacer{flex:1 1 auto}
.vy-ov__iconbtn{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:none;border-radius:var(--rounded-sm);background:transparent;color:var(--color-mute);cursor:pointer;font-family:var(--font-sans);font-size:16px;line-height:1}
.vy-ov__iconbtn:hover{background:var(--color-surface-elevated);color:var(--color-ink)}
.vy-ov__body{display:flex;flex-direction:column;gap:var(--space-lg);padding:var(--space-lg);max-height:min(60vh,520px);overflow:auto}
.vy-ov__section{display:flex;flex-direction:column;gap:var(--space-sm)}
.vy-ov__label{font-size:var(--type-caption-sm-size);line-height:var(--type-caption-sm-line);letter-spacing:var(--type-caption-sm-tracking);text-transform:uppercase;color:var(--color-mute)}
.vy-ov__transcript{display:flex;flex-direction:column;gap:var(--space-sm);margin:0;padding:0;list-style:none}
.vy-ov__t-row{display:flex;flex-direction:column;gap:var(--space-xxs)}
.vy-ov__t-speaker{font-size:var(--type-caption-sm-size);line-height:var(--type-caption-sm-line);letter-spacing:var(--type-caption-sm-tracking);text-transform:uppercase;color:var(--color-mute)}
.vy-ov__t-text{font-size:var(--type-body-sm-size);line-height:var(--type-body-sm-line);color:var(--color-body)}
.vy-ov__claim-row{display:flex;flex-direction:column;gap:var(--space-sm);width:100%;text-align:left;padding:var(--space-md);border:1px solid var(--color-hairline);border-radius:var(--rounded-md);background:var(--color-surface-elevated);color:var(--color-body);cursor:default;font-family:var(--font-sans);font-feature-settings:var(--font-feature-body)}
.vy-ov__claim-row.vy-ov__claim-row--interactive{cursor:pointer}
.vy-ov__claim-topline{display:flex;align-items:center;gap:var(--space-sm);flex-wrap:wrap}
.vy-ov__claim-text{font-size:var(--type-body-sm-size);line-height:var(--type-body-sm-line);color:var(--color-ink)}
.vy-ov__checking{display:inline-flex;align-items:center;font-size:var(--type-caption-md-size);line-height:var(--type-caption-md-line);letter-spacing:var(--type-caption-md-tracking);color:var(--color-mute)}
.vy-ov__empty{font-size:var(--type-body-sm-size);line-height:var(--type-body-sm-line);color:var(--color-mute)}
.vy-ov__alert{font-size:var(--type-body-sm-size);line-height:var(--type-body-sm-line);color:var(--color-accent-red)}
.vy-ov__caret{margin-left:auto;color:var(--color-mute);font-size:var(--type-caption-md-size)}
.vy-ov-card .vy-verdict-card{margin:0;max-width:100%;padding:var(--space-lg)}
.vy-ov-pill{display:inline-flex;align-items:center;gap:var(--space-sm);padding:var(--space-sm) var(--space-md);border:1px solid var(--color-hairline);border-radius:var(--rounded-full);background:var(--color-surface);color:var(--color-body);cursor:pointer;font-family:var(--font-sans);font-feature-settings:var(--font-feature-body)}
.vy-ov-pill:hover{border-color:var(--color-hairline-strong)}
`;

function TranscriptSection({transcripts}:{transcripts:TranscriptSegment[]}){
  if(!transcripts.length)return null;
  return <section className="vy-ov__section">
    <span className="vy-ov__label">Transcript</span>
    <ol className="vy-ov__transcript">
      {transcripts.map(item=><li key={item.segment_id} className="vy-ov__t-row">
        <span className="vy-ov__t-speaker">Speaker {item.speaker}</span>
        <span className="vy-ov__t-text">{item.text}</span>
      </li>)}
    </ol>
  </section>;
}

function ClaimSection({claim}:{claim:Claim}){
  const complete=claimIsComplete(claim);
  const [expanded,setExpanded]=React.useState(complete);
  // Auto-open the verdict the moment the claim completes.
  const prevComplete=React.useRef(complete);
  React.useEffect(()=>{if(complete&&!prevComplete.current)setExpanded(true);prevComplete.current=complete;},[complete]);
  const interactive=complete&&Boolean(claim.verdict);
  return <section className="vy-ov__section">
    <span className="vy-ov__label">Claim</span>
    <div
      className={`vy-ov__claim-row${interactive?" vy-ov__claim-row--interactive":""}`}
      role={interactive?"button":undefined}
      tabIndex={interactive?0:undefined}
      onClick={interactive?()=>setExpanded(v=>!v):undefined}
      onKeyDown={interactive?(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setExpanded(v=>!v);}}:undefined}
    >
      <div className="vy-ov__claim-topline">
        {claim.verdict?<VerdictBadge label={claim.verdict.label}/>:<span className="vy-ov__checking">Verity is checking…</span>}
        {interactive&&<span className="vy-ov__caret">{expanded?"Hide":"Details"}</span>}
      </div>
      {/* The expanded VerdictCard carries its own quote — only show it on the collapsed row. */}
      {!(claim.verdict&&expanded)&&<span className="vy-ov__claim-text">“{claim.exact_text}”</span>}
    </div>
    {claim.verdict&&expanded&&<VerdictCard claim={claim}/>}
  </section>;
}

export function Overlay({state}:{state?:OverlayState}){
  const [collapsed,setCollapsed]=React.useState(false);
  const status=deriveStatus(state);

  if(collapsed){
    return <button type="button" className="vy-ov-pill" onClick={()=>setCollapsed(false)} aria-label="Expand Verity">
      <VerityMark size={20}/>
      <StatusChip state={status}/>
    </button>;
  }

  return <div className="vy-palette vy-ov-card">
    <header className="vy-ov__head">
      <VerityMark size={24}/>
      <StatusChip state={status}/>
      <span className="vy-ov__head-spacer"/>
      <button type="button" className="vy-ov__iconbtn" onClick={()=>setCollapsed(true)} aria-label="Collapse Verity" title="Collapse">–</button>
    </header>
    <div className="vy-ov__body" aria-live="polite">
      {!state&&<p className="vy-ov__empty">Verity ready — start live listening or the disclosed fixture demo from the extension.</p>}
      {state&&<>
        <TranscriptSection transcripts={state.transcripts}/>
        {state.claim&&<ClaimSection claim={state.claim}/>}
        {!state.claim&&!state.transcripts.length&&!state.error&&<p className="vy-ov__empty">{state.mode==="fixture"?"Disclosed fixture running…":"Listening for the first claim…"}</p>}
        {state.error&&<p className="vy-ov__alert" role="alert">{state.error} Stop and retry from the extension.</p>}
      </>}
    </div>
  </div>;
}
