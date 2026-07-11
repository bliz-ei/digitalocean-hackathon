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
    <div className="vy-options__head">
      <VerityWordmark size={32}/>
      <h1 className="vy-heading-xl">Bring your own key</h1>
      <p className="vy-options__subtitle">Point Verity at your own inference provider. Requests run from this browser straight to the provider — your key never touches Verity’s backend.</p>
    </div>

    <form className="vy-options__form" onSubmit={(e)=>{e.preventDefault();void saveProvider();}}>
      <label className="vy-field">
        <span className="vy-field__label">Provider</span>
        <select className="vy-options__select" value={provider} onChange={(e)=>onProviderChange(e.target.value)}>
          <option value="digitalocean">DigitalOcean</option>
          <option value="openai">OpenAI</option>
        </select>
      </label>

      <TextInput label="API key" type="password" autoComplete="new-password" spellCheck={false} value={apiKey} onChange={(e)=>setApiKey(e.target.value)} placeholder="sk-…" help="Stored locally in extension storage and cleared from this field after saving."/>

      <div className="vy-options__grid">
        <TextInput label="Fast model" autoComplete="off" value={fastModel} onChange={(e)=>setFastModel(e.target.value)}/>
        <TextInput label="Reasoning model" autoComplete="off" value={reasoningModel} onChange={(e)=>setReasoningModel(e.target.value)}/>
      </div>

      <TextInput label="Monthly guard ($)" type="number" min="0.10" step="0.10" value={budget} onChange={(e)=>setBudget(e.target.value)} help="Verity stops BYOK requests once the estimated monthly spend reaches this cap."/>

      <div className="vy-options__actions">
        <Button variant="tertiary" type="button" onClick={()=>void testProvider()}>Test connection</Button>
        <Button variant="primary" type="submit">Save locally</Button>
        <span className="vy-options__spacer"/>
        <Button variant="tertiary" type="button" onClick={()=>void deleteProvider()}>Delete key</Button>
      </div>
      <p className="vy-options__result" role="status">{status}</p>
    </form>

    <p className="vy-options__note">Your API key and usage ledger are stored only in this browser’s local extension storage. Verity never sends your key to its backend; BYOK requests go directly from your browser to the provider you configure above.</p>
  </div>;
}

const rootEl=document.getElementById("verity-options-root");
if(rootEl)createRoot(rootEl).render(<React.StrictMode><Options/></React.StrictMode>);
