import type {ReactNode} from "react";
import {Reveal} from "../motion";
import {GlyphTiers, GlyphSeparate, GlyphCited} from "../glyphs";

type Card={tint:string;glyph:ReactNode;title:string;body:string};

const CARDS:Card[]=[
  {tint:"blue",glyph:<GlyphTiers/>,title:"Stored only in this browser",
   body:"Point Verity at your own inference provider. Your key lives in local extension storage and is cleared from the field the moment you save."},
  {tint:"green",glyph:<GlyphSeparate/>,title:"Straight to the provider",
   body:"BYOK requests run from your browser directly to the provider you configure. Verity never sends your key to its backend, and never logs it."},
  {tint:"coral",glyph:<GlyphCited/>,title:"Test, then delete",
   body:"Run a connection test before you save, set a monthly limit, and remove everything — key, models, and usage ledger — with one Delete key press."}
];

/** BYOK security (aside "Password Manager" band): the load-bearing key-safety story as a
 *  centered statement over three cards, then a two-column panel with a CSS mock of the
 *  extension key form. Copy is drawn verbatim from the extension options screen. */
export function Byok(){
  return (
    <section className="web-section" id="keys">
      <div className="web-wrap">
        <Reveal className="web-head">
          <span className="web-eyebrow">Bring your own key</span>
          <h2 className="vy-display-lg web-head__title">Your keys stay local.</h2>
          <p className="vy-body-lg web-head__lead">
            Point Verity at your own inference provider. Requests run from this browser
            straight to the provider — your key never touches Verity&rsquo;s backend.
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

        <Reveal className="web-byok">
          <div className="web-byok__copy">
            <h3 className="vy-heading-lg web-byok__title">Bring your own key</h3>
            <p className="vy-body-md web-byok__lead">
              Supports DigitalOcean and one OpenAI-compatible provider. A disclosed team
              demo key is the only fallback, and it is always labelled as one.
            </p>
            <ul className="web-byok__points">
              <li className="web-byok__point"><span className="web-byok__dot"/>Keys stored locally in extension storage</li>
              <li className="web-byok__point"><span className="web-byok__dot"/>Connection test, monthly limit, and Delete key</li>
              <li className="web-byok__point"><span className="web-byok__dot"/>Never persisted or logged on the backend</li>
            </ul>
          </div>

          <div className="web-byok__panel" aria-hidden="true">
            <div className="web-keyform">
              <span className="web-keyform__label">API key</span>
              <div className="web-keyform__input">
                <span className="web-keyform__value">sk-••••••••••••••••••••</span>
                <span className="web-keyform__pill">local</span>
              </div>
              <p className="web-keyform__help">Stored locally in extension storage and cleared from this field after saving.</p>
              <div className="web-keyform__row">
                <span className="web-keyform__btn web-keyform__btn--ghost">Test connection</span>
                <span className="web-keyform__btn web-keyform__btn--primary">Save locally</span>
              </div>
              <span className="web-keyform__status">Connection passed. Save to use this configuration.</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
