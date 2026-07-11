import {VerityWordmark} from "@verity/ui";
import {DEMO_VERDICT_URL, GITHUB_URL, PWA_BASE_URL} from "../config";

type Column={title:string;links:{label:string;href:string}[]};

const COLUMNS:Column[]=[
  {title:"Product",links:[
    {label:"How it works",href:"#how-it-works"},
    {label:"Verdicts",href:"#verdicts"},
    {label:"Your keys",href:"#keys"},
    {label:"Trust",href:"#trust"}
  ]},
  {title:"Demo",links:[
    {label:"Use the web app",href:PWA_BASE_URL},
    {label:"Open demo verdict",href:DEMO_VERDICT_URL},
    {label:"iPhone hand-off",href:"#iphone"}
  ]},
  {title:"Team",links:[
    {label:"Tri · extension & UI",href:GITHUB_URL},
    {label:"Moh · audio & transcription",href:GITHUB_URL},
    {label:"Jun · search & verdicts",href:GITHUB_URL},
    {label:"Arnav · backend & PWA",href:GITHUB_URL}
  ]},
  {title:"GitHub",links:[
    {label:"Repository",href:GITHUB_URL},
    {label:"DigitalOcean hackathon",href:GITHUB_URL}
  ]}
];

/** footer-section — light canvas, hairline top rule, mute link columns, wordmark, and a
 *  small legal line. Airy and shadowless (aside pattern); no dark stripe echo. */
export function Footer(){
  return (
    <footer className="web-footer">
      <div className="web-wrap web-footer__inner">
        <div className="web-footer__cols">
          {COLUMNS.map(col=>(
            <div key={col.title} className="web-footer__col">
              <span className="web-footer__coltitle">{col.title}</span>
              <ul className="web-footer__links">
                {col.links.map(link=>(
                  <li key={link.label}><a className="web-footer__link" href={link.href}>{link.label}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="web-footer__base">
          <VerityWordmark/>
          <span className="vy-caption-sm web-footer__legal">
            Verity is evidence-grounded and transparent, not perfectly unbiased. Prototype built for the DigitalOcean hackathon, 2026.
          </span>
        </div>
      </div>
    </footer>
  );
}
