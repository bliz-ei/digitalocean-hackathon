import {VerdictBadge, VerdictCard, heroClaim, type VerdictLabel} from "@verity/ui";

const DEFINITIONS:{label:VerdictLabel;body:string}[]=[
  {label:"Supported",body:"Credible sources back the claim as stated."},
  {label:"Misleading",body:"Partly true, but it drops context that changes the picture."},
  {label:"Disputed",body:"Credible sources genuinely conflict — the disagreement is preserved, not resolved."},
  {label:"Unsupported",body:"No credible evidence backs the claim."},
  {label:"Insufficient evidence",body:"Too little or too weak to rule — Verity fails closed instead of guessing."}
];

/** "Verdicts" anatomy — the five states with one-line definitions beside a full
 *  VerdictCard rendering the hero fixture, so the real evidence-vs-read split shows. */
export function Verdicts(){
  return (
    <section className="web-section" id="verdicts">
      <div className="web-wrap">
        <header className="web-head">
          <span className="web-eyebrow">Verdicts</span>
          <h2 className="vy-display-lg web-head__title">Five verdicts. Never false certainty.</h2>
          <p className="vy-body-lg web-head__lead">
            Every check resolves to one of five labels. When evidence is thin or sources
            conflict, Verity returns Insufficient evidence or Disputed — it will not manufacture confidence.
          </p>
        </header>

        <div className="web-verdicts">
          <ul className="web-verdicts__list">
            {DEFINITIONS.map(item=>(
              <li key={item.label} className="web-verdicts__row">
                <span className="web-verdicts__badge"><VerdictBadge label={item.label}/></span>
                <span className="vy-body-sm web-verdicts__def">{item.body}</span>
              </li>
            ))}
          </ul>

          <div className="web-verdicts__card">
            <VerdictCard claim={heroClaim}/>
          </div>
        </div>
      </div>
    </section>
  );
}
