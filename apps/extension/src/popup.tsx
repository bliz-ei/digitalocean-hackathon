import React from "react";
import {createRoot} from "react-dom/client";
import type {PairingChallenge} from "@verity/contracts";
import {Button,StatusChip,VerityWordmark,Keycap} from "@verity/ui";
import "@verity/ui";
import "./surfaces.css";
import {deriveStatus,type OverlayState} from "./overlay-view";
import {qrDataUrl} from "./qr";
import {pwaBaseUrl} from "./config";

const providerNames:Record<string,string>={digitalocean:"DigitalOcean",openai:"OpenAI"};

type StoredProvider={provider?:string;model?:string;apiKey?:string;baseUrl?:string};

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
    <div className="vy-popup__top">
      <VerityWordmark size={28}/>
      <span className="vy-popup__spacer"/>
      <Button variant="secondary" className="vy-btn--icon" aria-label="Open Verity settings" title="Settings" onClick={()=>chrome.runtime.openOptionsPage()}>⚙</Button>
    </div>

    <div className="vy-popup__status">
      <StatusChip state={status}/>
      {sessionActive&&<span className="vy-popup__mode">{overlay?.mode==="fixture"?"Fixture":"Live"}</span>}
    </div>

    <div className="vy-popup__actions">
      {sessionActive
        ?<Button variant="primary" onClick={()=>void send("STOP","Stopping…")}>Stop</Button>
        :<Button variant="primary" onClick={()=>void send("START_LIVE","Starting…")}>Start live listening</Button>}
      {!sessionActive&&<Button variant="secondary" className="vy-popup__demo" onClick={()=>void send("START_FIXTURE","Starting…")}>Run disclosed fixture demo</Button>}
    </div>
    <p className="vy-popup__msg" role="status">{message}</p>

    <div className="vy-card">
      <div className="vy-card__row">
        <span className="vy-card__label">Provider</span>
        <span className="vy-popup__spacer"/>
        {configured
          ?<span className="vy-card__value">{providerNames[configured.provider??""]??configured.provider??"Configured"}</span>
          :<span className="vy-chip">Demo key</span>}
      </div>
      {!configured&&<span className="vy-card__note">Demo key — team-funded, processed by Verity’s server. Add your own key in settings to run BYOK locally.</span>}
    </div>

    <div className="vy-card">
      <div className="vy-card__row">
        <span className="vy-card__label">Pair your iPhone</span>
        {sessionActive
          ?<button type="button" className="vy-linkbtn" onClick={()=>void togglePair()} aria-expanded={pairOpen}>{pairOpen?"Hide":"Show code"}</button>
          :<span className="vy-popup__spacer"/>}
      </div>
      {!sessionActive&&<span className="vy-card__note">Start a session to pair your phone.</span>}
      {sessionActive&&pairOpen&&<>
        {pairError&&<span className="vy-card__note" role="alert">{pairError}</span>}
        {pairing&&<>
          <div className="vy-pair__code" aria-label={`Pairing code ${pairing.code}`}>
            {pairing.code.split("").map((digit,i)=><Keycap key={i}>{digit}</Keycap>)}
          </div>
          <img className="vy-pair__qr" src={qrDataUrl(pairUrl)} alt="Pairing QR code" width={148} height={148}/>
          <span className="vy-pair__url">{pairUrl}</span>
        </>}
      </>}
    </div>
  </div>;
}

const rootEl=document.getElementById("verity-popup-root");
if(rootEl)createRoot(rootEl).render(<React.StrictMode><Popup/></React.StrictMode>);
