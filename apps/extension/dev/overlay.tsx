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
  // Busy "video-like" backdrop so the frosted-glass overlay visibly reads as glass
  // (simulates the YouTube page the real Shadow-DOM overlay floats over).
  const busy=
    "radial-gradient(circle at 22% 28%, #ff7a59 0, rgba(255,122,89,0) 34%),"+
    "radial-gradient(circle at 78% 22%, #4f7cff 0, rgba(79,124,255,0) 38%),"+
    "radial-gradient(circle at 58% 78%, #28c76f 0, rgba(40,199,111,0) 36%),"+
    "radial-gradient(circle at 90% 82%, #ffd93b 0, rgba(255,217,59,0) 30%),"+
    "linear-gradient(135deg, #12203a, #21304d)";
  return <div className="vy-root" style={{position:"fixed",inset:0,background:busy,backgroundSize:"cover",backgroundPosition:"center"}}>
    <div style={{position:"fixed",right:20,bottom:20,width:"min(360px,calc(100vw - 40px))"}}>
      <Overlay state={state}/>
    </div>
  </div>;
}

const style=document.createElement("style");
style.textContent=overlayCss;
document.head.append(style);
createRoot(document.getElementById("root")!).render(<Harness/>);
