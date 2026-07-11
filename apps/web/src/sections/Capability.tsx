import type {ReactNode} from "react";
import {Reveal} from "../motion";
import {GlyphListen, GlyphDetect, GlyphWeigh} from "../glyphs";

type Card={tint:string;glyph:ReactNode;title:string;body:string};

const CARDS:Card[]=[
  {tint:"blue",glyph:<GlyphListen/>,title:"Listen and transcribe",
   body:"The extension captures tab audio from a two-speaker discussion and labels Speaker A and Speaker B live — every line owned and timestamped, nothing else on the page touched."},
  {tint:"green",glyph:<GlyphDetect/>,title:"Detect the claim",
   body:"Verity separates checkable facts from rhetoric. Opinions never trigger a check — only factual claims do, flagged the instant they are spoken."},
  {tint:"coral",glyph:<GlyphWeigh/>,title:"Weigh the evidence",
   body:"It searches credible sources for evidence and counterevidence, reads them against the exact claim, and returns a cited verdict — in the overlay and on your paired iPhone."}
];

/** capability (aside "Anything you do in a browser" band): a centered statement over
 *  three pastel-gradient illustration cards. The five-step pipeline distilled to the
 *  three moves that matter — listen, detect, weigh — mirroring aside's three-card row. */
export function Capability(){
  return (
    <section className="web-section" id="how-it-works">
      <div className="web-wrap">
        <Reveal className="web-head">
          <span className="web-eyebrow">Live pipeline</span>
          <h2 className="vy-display-lg web-head__title">Anything checkable,<br/>checked while it&rsquo;s said.</h2>
          <p className="vy-body-lg web-head__lead">
            Three moves run continuously while the discussion plays — no pausing, no
            leaving the video, no waiting for a fact-check that arrives a day too late.
          </p>
        </Reveal>

        <div className="web-cards">
          {CARDS.map((card,i)=>(
            <Reveal key={card.title} as="article" className={`web-card web-card--${card.tint}`} delay={i*90}>
              <div className="web-card__art" aria-hidden="true">
                <span className="web-card__glyph">{card.glyph}</span>
              </div>
              <h3 className="vy-heading-sm web-card__title">{card.title}</h3>
              <p className="vy-body-sm web-card__body">{card.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
