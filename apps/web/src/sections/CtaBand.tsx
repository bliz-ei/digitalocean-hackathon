import {PWA_BASE_URL} from "../config";
import {Reveal} from "../motion";
import {AddToChrome} from "./AddToChrome";

/** Final CTA band (aside closing sky echo) — a full-bleed sky atmosphere mirroring the
 *  hero, one dark "Add to Chrome" pill, a ghost web-app link, and the hackathon caption. */
export function CtaBand({onInstall}:{onInstall:()=>void}){
  return (
    <section className="web-section web-cta">
      <div className="web-sky web-sky--echo" aria-hidden="true">
        <span className="web-sky__cloud web-sky__cloud--1"/>
        <span className="web-sky__cloud web-sky__cloud--2"/>
        <span className="web-sky__glow"/>
      </div>
      <div className="web-wrap web-cta__inner">
        <Reveal as="h2" className="vy-display-lg web-cta__title">Add transparent evidence to the argument.</Reveal>
        <Reveal as="p" className="vy-body-lg web-cta__lead" delay={80}>
          It adds transparent evidence to online disagreements while they are happening.
        </Reveal>
        <Reveal className="web-cta__actions" delay={160}>
          <AddToChrome onOpenModal={onInstall}/>
          <a href={PWA_BASE_URL} className="web-cta__secondary">Use the web app</a>
        </Reveal>
        <Reveal as="p" className="vy-caption-sm web-cta__caption" delay={220}>Built for the DigitalOcean hackathon.</Reveal>
      </div>
    </section>
  );
}
