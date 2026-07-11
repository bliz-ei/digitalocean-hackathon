import type {ReactNode} from "react";
import {Keycap} from "@verity/ui";
import {GlyphListen, GlyphTranscribe, GlyphDetect, GlyphWeigh, GlyphVerdict} from "../glyphs";

type Step={n:number;glyph:ReactNode;title:string;body:string};

const STEPS:Step[]=[
  {n:1,glyph:<GlyphListen/>,title:"Listen",
   body:"The extension captures the tab audio from a two-speaker YouTube discussion — nothing else on the page moves."},
  {n:2,glyph:<GlyphTranscribe/>,title:"Transcribe",
   body:"A live transcript labels Speaker A and Speaker B as they talk, so every line has an owner and a timestamp."},
  {n:3,glyph:<GlyphDetect/>,title:"Detect claims",
   body:"Verity separates checkable facts from rhetoric. Opinions never trigger a check — only factual claims do."},
  {n:4,glyph:<GlyphWeigh/>,title:"Weigh evidence",
   body:"It searches credible sources for both evidence and counterevidence, then reads them against the exact claim."},
  {n:5,glyph:<GlyphVerdict/>,title:"Deliver verdict",
   body:"A cited verdict lands in the overlay and on your paired iPhone — checking keeps running when the tab is backgrounded."}
];

/** "How it works" — the pipeline as five feature cards, each with a monochrome glyph
 *  and a numbered keycap accent. Copy grounded in the PRD. */
export function HowItWorks(){
  return (
    <section className="web-section web-section--white" id="how-it-works">
      <div className="web-wrap">
        <header className="web-head">
          <span className="web-eyebrow">How it works</span>
          <h2 className="vy-display-lg web-head__title">Live transcript to cited verdict.</h2>
          <p className="vy-body-lg web-head__lead">
            Five steps run continuously while the discussion plays — no pausing, no leaving the video.
          </p>
        </header>

        <ol className="web-steps">
          {STEPS.map(step=>(
            <li key={step.n} className="web-step">
              <div className="web-step__top">
                <span className="web-step__glyph">{step.glyph}</span>
                <Keycap>{step.n}</Keycap>
              </div>
              <h3 className="vy-heading-sm web-step__title">{step.title}</h3>
              <p className="vy-body-sm web-step__body">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
