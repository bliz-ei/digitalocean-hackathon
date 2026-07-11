import React from "react";
import {createRoot} from "react-dom/client";
import "@verity/ui";
import {heroTimeline,replayTimeline} from "@verity/ui";
import type {HeroEnvelope} from "@verity/ui";
import {Overlay,overlayCss,type OverlayState} from "../src/overlay-view";

/* Dev harness: drives the real <Overlay/> off replayTimeline(heroTimeline) so the five
 * StatusChip states cycle. `?t=<n>` folds events [0..n] synchronously for deterministic
 * screenshots (t=3 → checking, t=6 → completed verdict). No chrome.* needed — pure view. */

const initial:OverlayState={mode:"fixture",connection:"CONNECTING",transcripts:[]};

function reduce(state:OverlayState,envelope:HeroEnvelope):OverlayState{
  const {type,payload}=envelope as {type:string;payload:Record<string,unknown>};
  if(type==="transcript_final")return {...state,transcripts:[...state.transcripts,payload as never].slice(-8)};
  if(["claim_state","pipeline_state","verdict_complete"].includes(type)&&payload.claim)
    return {...state,claim:payload.claim as never,connection:String(payload.state)};
  return state;
}

function Harness(){
  const [state,setState]=React.useState<OverlayState>(initial);
  React.useEffect(()=>{
    const params=new URLSearchParams(location.search);
    const t=params.get("t");
    if(t!==null){
      const upto=Number(t);
      setState(heroTimeline.slice(0,upto+1).reduce((acc,ev)=>reduce(acc,ev.envelope as HeroEnvelope),initial));
      return;
    }
    return replayTimeline<HeroEnvelope>(heroTimeline.map(e=>({at:e.at,envelope:e.envelope as HeroEnvelope})),(env)=>setState(s=>reduce(s,env)),{loop:true});
  },[]);
  return <div className="vy-root" style={{position:"fixed",inset:0,background:"var(--color-canvas)"}}>
    <div style={{position:"fixed",right:20,bottom:20,width:"min(360px,calc(100vw - 40px))"}}>
      <Overlay state={state}/>
    </div>
  </div>;
}

const style=document.createElement("style");
style.textContent=overlayCss;
document.head.append(style);
createRoot(document.getElementById("root")!).render(<Harness/>);
