import {Button} from "@verity/ui";
import {CHROME_STORE_URL, DEMO_VERDICT_URL} from "../config";

/** Final CTA band — one white pill, a secondary demo link, hackathon caption. */
export function CtaBand(){
  return (
    <section className="web-section web-cta">
      <div className="web-wrap web-cta__inner">
        <h2 className="vy-display-lg web-cta__title">Add transparent evidence to the argument.</h2>
        <p className="vy-body-lg web-cta__lead">
          It adds transparent evidence to online disagreements while they are happening.
        </p>
        <div className="web-cta__actions">
          <a href={CHROME_STORE_URL}><Button variant="primary" tabIndex={-1}>Add to Chrome</Button></a>
          <a href={DEMO_VERDICT_URL} className="web-cta__secondary">Open demo verdict</a>
        </div>
        <p className="vy-caption-sm web-cta__caption">Built for the DigitalOcean hackathon.</p>
      </div>
    </section>
  );
}
