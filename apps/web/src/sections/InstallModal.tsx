import {useEffect, useRef} from "react";
import {Button} from "@verity/ui";
import {EXTENSION_ZIP_URL} from "../config";

const STEPS:{title:string;body:string}[]=[
  {title:"Unzip the download",
   body:"Your browser just downloaded verity-extension.zip. Unzip it — you'll get a folder named dist."},
  {title:"Open the extensions page",
   body:"In Chrome, go to chrome://extensions (paste it into the address bar and press Enter)."},
  {title:"Turn on Developer mode",
   body:"Flip the Developer mode switch in the top-right corner of that page."},
  {title:"Load unpacked",
   body:"Click Load unpacked and select the unzipped dist folder. Verity appears in your toolbar."},
  {title:"Start a check",
   body:"Open a two-speaker YouTube video, click the Verity icon, and press Start. Verdicts stream into the overlay."}
];

/** Load-unpacked install guide. Opens after the extension zip download fires from the
 *  "Add to Chrome" pill. White card on a glass scrim; dismiss via the close button, the
 *  scrim, or Escape. Focus is trapped loosely by moving it to the dialog on open. */
export function InstallModal({open,onClose}:{open:boolean;onClose:()=>void}){
  const cardRef=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    if(!open)return;
    const prev=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};
    window.addEventListener("keydown",onKey);
    cardRef.current?.focus();
    return ()=>{document.body.style.overflow=prev;window.removeEventListener("keydown",onKey);};
  },[open,onClose]);

  if(!open)return null;

  return (
    <div className="web-modal" role="presentation" onClick={onClose}>
      <div
        ref={cardRef}
        className="web-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        tabIndex={-1}
        onClick={(e)=>e.stopPropagation()}
      >
        <div className="web-modal__head">
          <div>
            <span className="web-modal__eyebrow">Load unpacked</span>
            <h2 id="install-title" className="vy-heading-lg web-modal__title">Install Verity in five steps</h2>
          </div>
          <button type="button" className="web-modal__close" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <p className="vy-body-sm web-modal__lead">
          The extension is a developer build for the hackathon — it loads unpacked rather
          than from the Chrome Web Store.
        </p>

        <ol className="web-modal__steps">
          {STEPS.map((step,i)=>(
            <li key={step.title} className="web-modal__step">
              <span className="web-modal__num">{i+1}</span>
              <div className="web-modal__stepcopy">
                <h3 className="vy-body-sm-strong web-modal__steptitle">{step.title}</h3>
                <p className="vy-body-sm web-modal__stepbody">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="web-modal__foot">
          <a href={EXTENSION_ZIP_URL} download className="web-modal__redownload">Download again</a>
          <Button variant="primary" onClick={onClose}>Got it</Button>
        </div>
      </div>
    </div>
  );
}
