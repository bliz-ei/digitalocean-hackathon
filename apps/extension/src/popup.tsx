import React from "react";
import {createRoot} from "react-dom/client";
import type {PairingChallenge} from "@verity/contracts";
import {Button,StatusChip,VerityWordmark,Keycap,AppIconTile} from "@verity/ui";
import "@verity/ui";
import "./surfaces.css";
import {deriveStatus,type OverlayState} from "./overlay-view";
import {qrDataUrl} from "./qr";
import {pwaBaseUrl} from "./config";

const providerNames:Record<string,string>={digitalocean:"DigitalOcean",openai:"OpenAI"};

type StoredProvider={provider?:string;model?:string;apiKey?:string;baseUrl?:string};

/* Presentational inline glyphs — stroke inherits currentColor so they read ink on tiles
 * and mute inside icon buttons. No behavior; purely visual chrome for the restyle. */
function CogIcon({size=18}:{size?:number}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
function KeyGlyph({size=22}:{size?:number}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <circle cx="8" cy="8" r="4.3" stroke="currentColor" strokeWidth="1.7"/>
    <path d="M11.1 11.1 20 20M16.5 15.5l2-2M18.4 17.4l1.8-1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
function PhoneGlyph({size=22}:{size?:number}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.6" stroke="currentColor" strokeWidth="1.7"/>
    <path d="M10.25 18.25h3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
  </svg>;
}

export function Popup(){
  const [overlay,setOverlay]=React.useState<OverlayState|undefined>();
  const [provider,setProvider]=React.useState<StoredProvider|undefined>();
  const [message,setMessage]=React.useState("Choose a mode. Capture starts only after your click.");
  const [pairOpen,setPairOpen]=React.useState(false);
  const [pairing,setPairing]=React.useState<PairingChallenge|undefined>();
  const [pairError,setPairError]=React.useState<string|undefined>();

  React.useEffect(()=>{
    void chrome.storage.session.get("overlayState").then(({overlayState})=>setOverlay(overlayState));
    void chrome.storage.local.get("verityProvider").then(({verityProvider})=>setProvider(verityProvider));
    const onChange=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{
      if(area==="session"&&changes.overlayState)setOverlay(changes.overlayState.newValue);
      if(area==="local"&&changes.verityProvider)setProvider(changes.verityProvider.newValue);
    };
    chrome.storage.onChanged.addListener(onChange);
    return ()=>chrome.storage.onChanged.removeListener(onChange);
  },[]);

  const sessionActive=Boolean(overlay);
  const status=deriveStatus(overlay);
  const configured=provider&&typeof provider.apiKey==="string"?provider:undefined;

  async function send(type:string,pending:string){
    setMessage(pending);
    try{
      const response=await chrome.runtime.sendMessage({type});
      setMessage(response?.ok?"Ready":response?.error??"Unable to continue");
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to continue");}
  }

  async function togglePair(){
    if(pairOpen){setPairOpen(false);return;}
    setPairOpen(true);
    if(pairing)return;
    setPairError(undefined);
    try{
      const response=await chrome.runtime.sendMessage({type:"PAIR_PHONE"});
      if(response?.ok)setPairing(response.challenge);
      else setPairError(response?.error??"Unable to create a pairing code.");
    }catch(error){setPairError(error instanceof Error?error.message:"Unable to create a pairing code.");}
  }

  const pairUrl=pairing?`${pwaBaseUrl}/?pair=${encodeURIComponent(pairing.redemption_token)}`:"";

  return <div className="vy-root vy-popup">
    <header className="vy-popup__header">
      <VerityWordmark size={26}/>
      <span className="vy-popup__spacer"/>
      <Button variant="secondary" className="vy-btn--icon" aria-label="Open Verity settings" title="Settings" onClick={()=>chrome.runtime.openOptionsPage()}><CogIcon/></Button>
    </header>

    <div className="vy-popup__body">
      <section className="vy-glass vy-popup__hero">
        <div className="vy-popup__statusrow">
          <StatusChip state={status}/>
          {sessionActive&&<span className={`vy-popup__mode vy-popup__mode--${overlay?.mode==="fixture"?"fixture":"live"}`}>{overlay?.mode==="fixture"?"Fixture":"Live"}</span>}
        </div>

        <div className="vy-popup__actions">
          {sessionActive
            ?<Button variant="primary" className="vy-popup__cta" onClick={()=>void send("STOP","Stopping…")}>Stop</Button>
            :<Button variant="primary" className="vy-popup__cta" onClick={()=>void send("START_LIVE","Starting…")}>Start live listening</Button>}
          {!sessionActive&&<Button variant="secondary" className="vy-popup__demo" onClick={()=>void send("START_FIXTURE","Starting…")}>Run disclosed fixture demo</Button>}
        </div>
        <p className="vy-popup__msg" role="status">{message}</p>
      </section>

      <div className="vy-card">
        <div className="vy-rowitem">
          <AppIconTile><KeyGlyph/></AppIconTile>
          <span className="vy-rowitem__text">
            <span className="vy-rowitem__label">Provider</span>
            <span className="vy-rowitem__sub">{configured?"Local BYOK · direct to provider":"Team-funded · runs on Verity’s server"}</span>
          </span>
          {configured
            ?<span className="vy-card__value">{providerNames[configured.provider??""]??configured.provider??"Configured"}</span>
            :<span className="vy-chip">Demo key</span>}
        </div>
        {!configured&&<span className="vy-card__note">Demo key — team-funded, processed by Verity’s server. Add your own key in settings to run BYOK locally.</span>}
      </div>

      <div className="vy-card">
        <div className="vy-rowitem">
          <AppIconTile><PhoneGlyph/></AppIconTile>
          <span className="vy-rowitem__text">
            <span className="vy-rowitem__label">Pair your iPhone</span>
            <span className="vy-rowitem__sub">{sessionActive?"Second-screen verdicts on your phone":"Start a session to pair your phone."}</span>
          </span>
          {sessionActive&&<button type="button" className="vy-linkbtn" onClick={()=>void togglePair()} aria-expanded={pairOpen}>{pairOpen?"Hide":"Show code"}</button>}
        </div>
        {sessionActive&&pairOpen&&<div className="vy-pair">
          {pairError&&<span className="vy-card__note" role="alert">{pairError}</span>}
          {pairing&&<>
            <div className="vy-pair__code" aria-label={`Pairing code ${pairing.code}`}>
              {pairing.code.split("").map((digit,i)=><Keycap key={i}>{digit}</Keycap>)}
            </div>
            <div className="vy-pair__qrframe">
              <img className="vy-pair__qr" src={qrDataUrl(pairUrl)} alt="Pairing QR code" width={148} height={148}/>
            </div>
            <span className="vy-pair__url">{pairUrl}</span>
          </>}
        </div>}
      </div>
    </div>
  </div>;
}

const rootEl=document.getElementById("verity-popup-root");
if(rootEl)createRoot(rootEl).render(<React.StrictMode><Popup/></React.StrictMode>);
