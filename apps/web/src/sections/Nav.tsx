import {useEffect, useState} from "react";
import {Button, VerityWordmark} from "@verity/ui";
import {CHROME_STORE_URL, DEMO_VERDICT_URL} from "../config";

const LINKS=[
  {href:"#how-it-works",label:"How it works"},
  {href:"#verdicts",label:"Verdicts"},
  {href:"#trust",label:"Trust"},
  {href:"#iphone",label:"iPhone"}
];

/** primary-nav (DESIGN.md): glass sticky bar — wordmark left, centered anchor cluster,
 *  right cluster of a secondary demo link + the dark "Add to Chrome" pill. At ≤768px the
 *  center cluster collapses into a glass drawer; the dark pill stays visible. */
export function Nav(){
  const [open,setOpen]=useState(false);

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
    <header className="web-nav">
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
          <a href={DEMO_VERDICT_URL} className="web-nav__demo">Open demo verdict</a>
          <a href={CHROME_STORE_URL}><Button variant="primary" tabIndex={-1}>Add to Chrome</Button></a>
        </div>
      </div>

      <div className={`web-drawer${open?" web-drawer--open":""}`} role="dialog" aria-modal="true" aria-label="Menu" hidden={!open}>
        <div className="web-drawer__bar">
          <VerityWordmark/>
          <button type="button" className="web-drawer__close" aria-label="Close menu" onClick={()=>setOpen(false)}>Close</button>
        </div>
        <nav className="web-drawer__links" aria-label="Primary">
          {LINKS.map(link=><a key={link.href} href={link.href} className="web-drawer__link" onClick={()=>setOpen(false)}>{link.label}</a>)}
          <a href={DEMO_VERDICT_URL} className="web-drawer__link" onClick={()=>setOpen(false)}>Open demo verdict</a>
        </nav>
      </div>
    </header>
  );
}
