import {VerdictBadge, VerityMark} from "@verity/ui";
import {Reveal} from "../motion";

/** "iPhone" cross-device (aside "Memory" band cadence) — a CSS-only phone frame showing
 *  the verbatim push copy and a mini verdict summary, closing on the load-bearing brand
 *  line. Copy reveals from the left, the device from the right. */
export function IPhone(){
  return (
    <section className="web-section" id="iphone">
      <div className="web-wrap web-iphone">
        <Reveal className="web-iphone__copy">
          <span className="web-eyebrow">Across devices</span>
          <h2 className="vy-display-lg web-head__title">Minimize the tab. The verdict still finds you.</h2>
          <p className="vy-body-lg web-head__lead">
            Checking continues after the YouTube tab loses focus. When the verdict is
            ready, Verity pushes it to your paired iPhone — the same claim, one tap away.
          </p>
          <p className="vy-heading-lg web-iphone__closer">Verity follows the claim&mdash;not the platform.</p>
        </Reveal>

        <Reveal className="web-iphone__device" delay={120} role="img" aria-label="iPhone lock screen showing a Verity notification and verdict summary">
          <div className="web-iphone__notch"/>
          <div className="web-iphone__screen">
            <div className="web-push">
              <div className="web-push__head">
                <span className="web-push__icon"><VerityMark size={28}/></span>
                <span className="web-push__app">Verity</span>
                <span className="web-push__time">now</span>
              </div>
              <p className="web-push__body">Verity found missing context — tap to inspect 3 sources.</p>
            </div>

            <div className="web-phoneverdict">
              <span className="web-phoneverdict__eyebrow">Verdict</span>
              <div className="web-phoneverdict__topline">
                <VerdictBadge label="Misleading"/>
                <span className="web-phoneverdict__conf">High confidence</span>
              </div>
              <blockquote className="web-phoneverdict__claim">&ldquo;Electric vehicles produce no carbon emissions.&rdquo;</blockquote>
              <p className="web-phoneverdict__why">EVs have no tailpipe emissions, but lifecycle emissions remain.</p>
              <span className="web-phoneverdict__meta">3 cited sources · EPA · IEA · Reuters</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
