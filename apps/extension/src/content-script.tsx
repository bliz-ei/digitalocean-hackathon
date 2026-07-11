import React from "react";
import {createRoot,Root} from "react-dom/client";
import type {Claim,TranscriptSegment} from "@verity/contracts";
import {VerdictCard} from "@verity/ui";
import uiStyles from "../../../packages/ui/src/tokens.css?inline";

const id="verity-shadow-host";
type OverlayState={mode:"fixture"|"live";connection:string;transcripts:TranscriptSegment[];pairingCode?:string;pairingExpiresAt?:string;claim?:Claim;error?:string};
let root:Root|undefined;

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

function mount(state?:OverlayState){
  let host=document.getElementById(id);
  if(!host){host=document.createElement("aside");host.id=id;document.body.append(host)}
  const shadow=host.shadowRoot??host.attachShadow({mode:"open"});
  let target=shadow.querySelector("#verity-root") as HTMLElement|null;
  if(!target){
    const style=document.createElement("style");
    style.textContent=`${uiStyles.replace(":root",":host")}:host{all:initial;position:fixed;z-index:2147483000;right:20px;top:76px;width:min(400px,calc(100vw - 40px));max-height:calc(100vh - 96px);overflow:auto;font:14px/1.45 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.verity-card{margin:0}.shell{box-sizing:border-box;padding:16px;border-radius:14px;background:#fff;color:#142019;box-shadow:0 3px 8px #0002}.shell h2{margin:.35rem 0}.shell ol{padding-left:1.25rem;max-height:240px;overflow:auto}.shell li{margin:.55rem 0;padding:.35rem 0;border-bottom:1px solid #e1e9e3}.shell blockquote{margin:.7rem 0;padding:.7rem;border-radius:9px;background:#f5f8f6}.shell code{display:inline-block;padding:.22rem .5rem;border-radius:7px;background:#e5f1e9;color:#154d36;font:750 1.15rem/1 ui-monospace,SFMono-Regular,monospace;letter-spacing:.14em}.shell [role=alert]{padding:.65rem;border-radius:9px;background:#fbeceb;color:#852f28}`;
    target=document.createElement("div");target.id="verity-root";shadow.append(style,target);
  }
  root??=createRoot(target);root.render(<Overlay state={state}/>);
}

mount();
void chrome.storage.session.get("overlayState").then(({overlayState})=>overlayState&&mount(overlayState));
chrome.runtime.onMessage.addListener(message=>{
  if(message.type==="OVERLAY_STATE")mount(message.state);
  if(message.type==="STOP"){root?.unmount();root=undefined;document.getElementById(id)?.remove()}
});
