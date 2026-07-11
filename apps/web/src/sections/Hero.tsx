import {PWA_BASE_URL} from "../config";
import {Reveal} from "../motion";
import {AddToChrome} from "./AddToChrome";
import {HeroReplay} from "./HeroReplay";

/** hero-sky-band (aside pattern): a full-bleed, light sky-like atmosphere rendered in
 *  CSS — soft blue wash, slow-drifting blurred cloud shapes, and a faint Verity-coral
 *  horizon glow for brand continuity. A pill badge sits above the centered display
 *  headline; one dark "Add to Chrome" pill and a ghost web-app link form the CTA row;
 *  the browser-window product mockup floats beneath as the dominant hero visual. */
export function Hero({onInstall}:{onInstall:()=>void}){
  return (
    <section className="web-hero" id="top">
      {/* Ambient sky: layered gradients + independently drifting blurred cloud blobs. */}
      <div className="web-sky" aria-hidden="true">
        <span className="web-sky__cloud web-sky__cloud--1"/>
        <span className="web-sky__cloud web-sky__cloud--2"/>
        <span className="web-sky__cloud web-sky__cloud--3"/>
        <span className="web-sky__glow"/>
      </div>

      <div className="web-hero__inner">
        <div className="web-hero__copy">
          <Reveal className="web-badge" as="a" href="#how-it-works">
            Built for the DigitalOcean Hackathon
            <span className="web-badge__chev" aria-hidden="true">›</span>
          </Reveal>
          <Reveal as="h1" className="vy-display-xl web-hero__headline" delay={80}>
            Fact-check the conversation.<br/>While it&rsquo;s happening.
          </Reveal>
          <Reveal as="p" className="vy-body-lg web-hero__sub" delay={160}>
            Verity watches two-speaker YouTube discussions, catches the checkable claims,
            and returns a cited verdict — evidence and counterevidence — before the
            argument moves on.
          </Reveal>
          <Reveal className="web-hero__cta" delay={240}>
            <AddToChrome onOpenModal={onInstall}/>
            <a href={PWA_BASE_URL} className="web-hero__secondary">Use the web app</a>
          </Reveal>
        </div>

        <Reveal className="web-hero__visual" delay={320}>
          <div className="web-browser">
            <div className="web-browser__bar">
              <span className="web-browser__lights" aria-hidden="true">
                <span className="web-browser__light web-browser__light--r"/>
                <span className="web-browser__light web-browser__light--y"/>
                <span className="web-browser__light web-browser__light--g"/>
              </span>
              <span className="web-browser__url">
                <svg className="web-browser__lock" width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>
                </svg>
                youtube.com/watch
              </span>
            </div>
            <div className="web-browser__viewport">
              <HeroReplay/>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
