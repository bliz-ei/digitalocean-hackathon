import {useEffect, useState} from "react";
import {VerityWordmark} from "@verity/ui";
import {PWA_BASE_URL} from "../config";
import {AddToChrome} from "./AddToChrome";

const LINKS=[
  {href:"#how-it-works",label:"How it works"},
  {href:"#verdicts",label:"Verdicts"},
  {href:"#keys",label:"Your keys"},
  {href:"#trust",label:"Trust"}
];

/** primary-nav (aside pattern): transparent over the hero sky, then transitions to a
 *  frosted glass bar with a hairline once the page scrolls past the fold. Wordmark left,
 *  centered anchor cluster, right cluster of a ghost web-app link + the dark "Add to
 *  Chrome" pill. At ≤768px the center cluster collapses into a glass drawer. */
export function Nav({onInstall}:{onInstall:()=>void}){
  const [open,setOpen]=useState(false);
  const [scrolled,setScrolled]=useState(false);

  // Nav gains its glass background once the visitor scrolls off the hero top.
  useEffect(()=>{
    const onScroll=()=>setScrolled(window.scrollY>24);
    onScroll();
    window.addEventListener("scroll",onScroll,{passive:true});
    return ()=>window.removeEventListener("scroll",onScroll);
  },[]);

  // Lock body scroll and close on Escape while the drawer is open.
  useEffect(()=>{
    if(!open)return;
    const prev=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false);};
    window.addEventListener("keydown",onKey);
    return ()=>{document.body.style.overflow=prev;window.removeEventListener("keydown",onKey);};
  },[open]);

  return (
    <header className={`web-nav${scrolled?" is-scrolled":""}`}>
      <div className="web-nav__inner">
        <button type="button" className="web-nav__burger" aria-label="Open menu" aria-expanded={open} onClick={()=>setOpen(true)}>
          <span/><span/><span/>
        </button>

        <a href="#top" className="web-nav__brand" aria-label="Verity home">
          <VerityWordmark/>
        </a>

        <nav className="web-nav__links" aria-label="Primary">
          {LINKS.map(link=><a key={link.href} href={link.href} className="web-nav__link">{link.label}</a>)}
        </nav>

        <div className="web-nav__cta">
          <a href={PWA_BASE_URL} className="web-nav__demo">Use the web app</a>
          <AddToChrome onOpenModal={onInstall} tabIndex={-1}/>
        </div>
      </div>

      <div className={`web-drawer${open?" web-drawer--open":""}`} role="dialog" aria-modal="true" aria-label="Menu" hidden={!open}>
        <div className="web-drawer__bar">
          <VerityWordmark/>
          <button type="button" className="web-drawer__close" aria-label="Close menu" onClick={()=>setOpen(false)}>Close</button>
        </div>
        <nav className="web-drawer__links" aria-label="Primary">
          {LINKS.map(link=><a key={link.href} href={link.href} className="web-drawer__link" onClick={()=>setOpen(false)}>{link.label}</a>)}
          <a href={PWA_BASE_URL} className="web-drawer__link" onClick={()=>setOpen(false)}>Use the web app</a>
        </nav>
      </div>
    </header>
  );
}
