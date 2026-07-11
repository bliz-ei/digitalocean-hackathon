import {Button} from "@verity/ui";
import {CHROME_STORE_URL} from "../config";
import {HeroReplay} from "./HeroReplay";

/** hero-wash-band: a diffuse red-coral ambient wash appears once, here, behind the
 *  centered hero copy and the glass product mockup that floats beneath it (aside pattern). */
export function Hero(){
  return (
    <section className="web-hero" id="top">
      <div className="web-hero__wash" aria-hidden="true"/>
      <div className="web-hero__inner">
        <div className="web-hero__copy">
          <h1 className="vy-display-xl web-hero__headline">
            Fact-check the conversation.<br/>While it&rsquo;s happening.
          </h1>
          <p className="vy-body-lg web-hero__sub">
            Verity watches two-speaker YouTube discussions, catches the checkable claims,
            and returns a cited verdict — evidence and counterevidence — before the
            argument moves on.
          </p>
          <div className="web-hero__cta">
            <a href={CHROME_STORE_URL}><Button variant="primary" tabIndex={-1}>Add to Chrome</Button></a>
            <a href="#how-it-works" className="web-hero__secondary">Watch the demo</a>
          </div>
        </div>
        <div className="web-hero__visual">
          <HeroReplay/>
        </div>
      </div>
    </section>
  );
}
