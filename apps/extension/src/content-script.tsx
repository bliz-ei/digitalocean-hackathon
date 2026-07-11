import React from "react";
import {createRoot,Root} from "react-dom/client";
import type {Claim,TranscriptSegment} from "@verity/contracts";
import {VerdictCard,verityCss,interFontFaceCss} from "@verity/ui";

const id="verity-shadow-host";
type OverlayState={mode:"fixture"|"live";connection:string;transcripts:TranscriptSegment[];pairingCode?:string;pairingExpiresAt?:string;claim?:Claim;error?:string};
let root:Root|undefined;

const hostCss=`:host{all:initial;position:fixed;z-index:2147483647;right:20px;top:76px;width:min(400px,calc(100vw - 40px));max-height:calc(100vh - 96px);overflow:auto}.vy-root{font-family:var(--font-sans);font-feature-settings:var(--font-feature-body);color:var(--color-body)}.vy-verdict-card{margin:0}.shell{box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-md);padding:var(--space-lg);border:1px solid var(--color-hairline);border-radius:var(--rounded-lg);background:var(--color-surface);color:var(--color-body)}.shell small{color:var(--color-mute)}.shell h2{margin:0;font-size:var(--type-heading-md-size);color:var(--color-ink)}.shell ol{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:var(--space-sm);max-height:240px;overflow:auto}.shell li{color:var(--color-body)}.shell blockquote{margin:0;padding:var(--space-sm) var(--space-md);border-left:1px solid var(--color-hairline-strong);background:var(--color-surface-elevated);border-radius:var(--rounded-xs);color:var(--color-ink)}.shell code{font-family:var(--font-mono);color:var(--color-ink)}.shell [role=alert]{color:var(--color-accent-red)}`;

function Overlay({state}:{state?:OverlayState}){
  if(!state)return <section className="shell" role="status">Verity ready — start live listening or the fixture from the extension.</section>;
  if(state.claim&&(state.claim.verdict||["COMPLETE","INSUFFICIENT_EVIDENCE","FAILED"].includes(state.claim.state)))return <VerdictCard claim={state.claim}/>;
  return <section className="shell" aria-live="polite">
    <small>{state.mode==="fixture"?"Fixture mode":"Live transcript"}</small>
    <h2>{state.claim?"Verity is checking…":state.connection}</h2>
    {state.pairingCode&&<p><strong>iPhone pairing:</strong> <code>{state.pairingCode}</code></p>}
    {state.claim&&<blockquote>“{state.claim.exact_text}”<br/><small>{state.claim.speaker_label} · {(state.claim.start_ms/1000).toFixed(1)}s</small></blockquote>}
    <ol>{state.transcripts.map(item=><li key={item.segment_id}><strong>Speaker {item.speaker}</strong> {item.text}</li>)}</ol>
    {state.error&&<p role="alert">{state.error} Stop and retry from the extension.</p>}
  </section>;
}

function ensureFont(){
  try{
    if(document.getElementById("verity-font"))return;
    const base=chrome.runtime.getURL("");
    const style=document.createElement("style");
    style.id="verity-font";style.textContent=interFontFaceCss(base);
    document.head.append(style);
  }catch{/* font is optional; system-ui fallback covers it */}
}

function mount(state?:OverlayState){
  ensureFont();
  let host=document.getElementById(id);
  if(!host){host=document.createElement("aside");host.id=id;document.body.append(host)}
  const shadow=host.shadowRoot??host.attachShadow({mode:"open"});
  let target=shadow.querySelector("#verity-root") as HTMLElement|null;
  if(!target){
    const sheet=new CSSStyleSheet();sheet.replaceSync(`${verityCss}\n${hostCss}`);
    shadow.adoptedStyleSheets=[sheet];
    target=document.createElement("div");target.id="verity-root";target.className="vy-root";shadow.append(target);
  }
  root??=createRoot(target);root.render(<Overlay state={state}/>);
}

mount();
void chrome.storage.session.get("overlayState").then(({overlayState})=>overlayState&&mount(overlayState));
chrome.runtime.onMessage.addListener(message=>{
  if(message.type==="OVERLAY_STATE")mount(message.state);
  if(message.type==="STOP"){root?.unmount();root=undefined;document.getElementById(id)?.remove()}
});
