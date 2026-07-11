import {Button} from "@verity/ui";
import {EXTENSION_ZIP_URL} from "../config";

function DownloadGlyph(){
  return (
    <svg className="web-atc__icon" width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>
    </svg>
  );
}

/** The primary "Add to Chrome" pill. The anchor's native `download` fetches the packaged
 *  extension zip; the click also opens the load-unpacked install modal. Used in the nav,
 *  hero, and closing CTA band so the download + guide behaviour is defined once. */
export function AddToChrome({onOpenModal,tabIndex}:{onOpenModal:()=>void;tabIndex?:number}){
  return (
    <a href={EXTENSION_ZIP_URL} download className="web-atc" onClick={onOpenModal}>
      <Button variant="primary" tabIndex={tabIndex}>
        <DownloadGlyph/>Add to Chrome
      </Button>
    </a>
  );
}
