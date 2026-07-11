import React from "react";
import {createRoot,Root} from "react-dom/client";
import {verityCss,interFontFaceCss} from "@verity/ui";
import {Overlay,overlayCss,type OverlayState} from "./overlay-view";

const id="verity-shadow-host";
let root:Root|undefined;

/* Host positioning + pointer-events scoping. The host is a zero-size fixed box; only
 * the card/pill inside it receive pointer events, so the overlay never intercepts
 * clicks outside its own bounds and never blocks the YouTube player controls. */
const hostCss=`:host{all:initial;position:fixed;z-index:2147483647;right:20px;bottom:20px;top:auto;width:min(360px,calc(100vw - 40px));pointer-events:none}.vy-ov-card,.vy-ov-pill{pointer-events:auto}`;

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
    const sheet=new CSSStyleSheet();sheet.replaceSync(`${verityCss}\n${overlayCss}\n${hostCss}`);
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
