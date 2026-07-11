import React from "react";
import {createRoot} from "react-dom/client";
import {Button,TextInput,VerityWordmark} from "@verity/ui";
import "@verity/ui";
import "./surfaces.css";

/* Full BYOK form. The provider endpoints, values() validation, save/delete/test flows,
 * their exact status strings, the 5s abort, loadDefaults model IDs, and the storage keys
 * (verityProvider / verityUsageLedger) are migrated verbatim from the original popup.ts. */

const endpoints={digitalocean:"https://inference.do-ai.run",openai:"https://api.openai.com"} as const;

function defaultsFor(provider:string):{fastModel:string;reasoningModel:string}{
  return provider==="digitalocean"
    ?{fastModel:"llama3.3-70b-instruct",reasoningModel:"gpt-oss-120b"}
    :{fastModel:"gpt-4.1-mini",reasoningModel:"gpt-5-mini"};
}
function safe(error:unknown){return error instanceof Error?error.message.slice(0,160):"Unable to save settings.";}

/* Presentational only: map a status string to a tone class so the inline result reads
 * green on success / red on failure (the sanctioned accent-on-text status use). The status
 * strings themselves are unchanged — this only picks a color from the known messages. */
function statusTone(status:string):string{
  if(!status||status==="Testing…")return "";
  const ok=status.startsWith("Saved locally")||status.startsWith("Connection passed")||status.startsWith("Key, models");
  return ok?" vy-options__result--ok":" vy-options__result--err";
}

function ChevronIcon(){
  return <svg className="vy-select__chevron" width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
function LockGlyph(){
  return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.4" stroke="currentColor" strokeWidth="1.7"/>
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    <circle cx="12" cy="15.5" r="1.4" fill="currentColor"/>
  </svg>;
}

export function Options(){
  const [provider,setProvider]=React.useState("digitalocean");
  const [apiKey,setApiKey]=React.useState("");
  const [fastModel,setFastModel]=React.useState("");
  const [reasoningModel,setReasoningModel]=React.useState("");
  const [budget,setBudget]=React.useState("10");
  const [status,setStatus]=React.useState("");

  React.useEffect(()=>{
    void chrome.storage.local.get("verityProvider").then(({verityProvider})=>{
      if(!verityProvider){const d=defaultsFor("digitalocean");setFastModel(d.fastModel);setReasoningModel(d.reasoningModel);return;}
      setProvider(verityProvider.provider??"digitalocean");
      setFastModel(verityProvider.model??"");
      setReasoningModel(verityProvider.reasoningModel??"");
      setBudget(String(verityProvider.monthlyLimit??10));
    });
  },[]);

  function onProviderChange(next:string){
    setProvider(next);
    const d=defaultsFor(next);
    setFastModel(d.fastModel);
    setReasoningModel(d.reasoningModel);
  }

  function values(){
    const baseUrl=endpoints[provider as keyof typeof endpoints];
    const limit=Number(budget);
    if(!apiKey.trim()||!fastModel.trim()||!reasoningModel.trim())throw new Error("Key and both model IDs are required.");
    if(!Number.isFinite(limit)||limit<=0)throw new Error("Enter a positive monthly guard.");
    return {baseUrl,apiKey:apiKey.trim(),model:fastModel.trim(),reasoningModel:reasoningModel.trim(),monthlyLimit:limit,provider};
  }

  async function saveProvider(){
    try{const config=values();await chrome.storage.local.set({verityProvider:config});setApiKey("");setStatus("Saved locally. Verity will never display the key again.");}
    catch(error){setStatus(safe(error));}
  }
  async function deleteProvider(){
    await chrome.storage.local.remove(["verityProvider","verityUsageLedger"]);setApiKey("");setStatus("Key, models, and usage ledger deleted.");
  }
  async function testProvider(){
    try{
      const config=values();setStatus("Testing…");
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5_000);
      const response=await fetch(`${config.baseUrl}/v1/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},signal:controller.signal,body:JSON.stringify({model:config.model,max_tokens:1,messages:[{role:"user",content:"Reply OK"}]})});clearTimeout(timer);
      if(response.status===401||response.status===403)throw new Error("Authentication or model permission failed.");
      if(response.status===429)throw new Error("Provider rate limit reached.");
      if(!response.ok)throw new Error(`Provider compatibility test failed (${response.status}).`);
      setStatus("Connection passed. Save to use this configuration.");
    }catch(error){setStatus(error instanceof DOMException&&error.name==="AbortError"?"Provider test timed out.":safe(error));}
  }

  return <div className="vy-root vy-options">
    <header className="vy-options__head">
      <VerityWordmark size={30}/>
      <span className="vy-options__eyebrow">Settings · Bring your own key</span>
      <h1 className="vy-heading-xl vy-options__title">Run Verity on your own inference key</h1>
      <p className="vy-options__subtitle">Point Verity at your own inference provider. Requests run from this browser straight to the provider — your key never touches Verity’s backend.</p>
    </header>

    <form className="vy-options__form" onSubmit={(e)=>{e.preventDefault();void saveProvider();}}>
      <section className="vy-options__section">
        <span className="vy-options__section-label">Provider &amp; key</span>
        <label className="vy-field">
          <span className="vy-field__label">Provider</span>
          <div className="vy-select">
            <select className="vy-select__input" value={provider} onChange={(e)=>onProviderChange(e.target.value)}>
              <option value="digitalocean">DigitalOcean</option>
              <option value="openai">OpenAI</option>
            </select>
            <ChevronIcon/>
          </div>
        </label>

        <TextInput className="vy-options__key" label="API key" type="password" autoComplete="new-password" spellCheck={false} value={apiKey} onChange={(e)=>setApiKey(e.target.value)} placeholder="sk-…" help="Stored locally in extension storage and cleared from this field after saving."/>
      </section>

      <section className="vy-options__section">
        <span className="vy-options__section-label">Models</span>
        <div className="vy-options__grid">
          <TextInput label="Fast model" autoComplete="off" value={fastModel} onChange={(e)=>setFastModel(e.target.value)}/>
          <TextInput label="Reasoning model" autoComplete="off" value={reasoningModel} onChange={(e)=>setReasoningModel(e.target.value)}/>
        </div>
      </section>

      <section className="vy-options__section">
        <span className="vy-options__section-label">Spending guard</span>
        <TextInput label="Monthly guard ($)" type="number" min="0.10" step="0.10" value={budget} onChange={(e)=>setBudget(e.target.value)} help="Verity stops BYOK requests once the estimated monthly spend reaches this cap."/>
      </section>

      <div className="vy-options__actions">
        <Button variant="primary" type="submit">Save locally</Button>
        <Button variant="tertiary" type="button" onClick={()=>void testProvider()}>Test connection</Button>
        <span className="vy-options__spacer"/>
        <Button variant="tertiary" type="button" className="vy-options__delete" onClick={()=>void deleteProvider()}>Delete key</Button>
      </div>
      <p className={`vy-options__result${statusTone(status)}`} role="status">{status}</p>
    </form>

    <aside className="vy-options__trust">
      <span className="vy-options__trust-icon"><LockGlyph/></span>
      <div className="vy-options__trust-text">
        <span className="vy-options__trust-title">Your keys stay local</span>
        <p className="vy-options__note">Your API key and usage ledger are stored only in this browser’s local extension storage. Verity never sends your key to its backend; BYOK requests go directly from your browser to the provider you configure above.</p>
      </div>
    </aside>
  </div>;
}

const rootEl=document.getElementById("verity-options-root");
if(rootEl)createRoot(rootEl).render(<React.StrictMode><Options/></React.StrictMode>);
