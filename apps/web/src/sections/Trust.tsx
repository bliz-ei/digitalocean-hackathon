import type {ReactNode} from "react";
import {GlyphTiers, GlyphSeparate, GlyphCited} from "../glyphs";

type Card={glyph:ReactNode;title:string;body:string};

const CARDS:Card[]=[
  {glyph:<GlyphTiers/>,title:"Sourced by tier",
   body:"Primary sources, government data, and peer-reviewed research are preferred and labeled by tier — so you can weigh where a fact comes from."},
  {glyph:<GlyphSeparate/>,title:"Evidence, then interpretation",
   body:"Source excerpts stay visually separate from Verity's read. You see the evidence before the conclusion, on every verdict."},
  {glyph:<GlyphCited/>,title:"No verdict without citations",
   body:"No claim is ruled without sources. Opinions are never checked, and people are never scored — only claims are."}
];

/** "Trust" — the honest framing plus three dark feature cards covering source tiers,
 *  the evidence/interpretation split, and the hard rules. */
export function Trust(){
  return (
    <section className="web-section" id="trust">
      <div className="web-wrap">
        <header className="web-head">
          <span className="web-eyebrow">Trust</span>
          <h2 className="vy-display-lg web-head__title">Evidence-grounded and transparent — not perfectly unbiased.</h2>
          <p className="vy-body-lg web-head__lead">
            Verity does not decide who is right. It makes the factual basis of a
            disagreement easier to examine, and it shows its work.
          </p>
        </header>

        <div className="web-trust">
          {CARDS.map(card=>(
            <article key={card.title} className="web-trustcard">
              <span className="web-trustcard__glyph">{card.glyph}</span>
              <h3 className="vy-heading-sm web-trustcard__title">{card.title}</h3>
              <p className="vy-body-sm web-trustcard__body">{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
