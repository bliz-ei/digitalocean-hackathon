const statusNode=document.querySelector("#status");
const providerStatus=document.querySelector("#provider-status");
const provider=document.querySelector("#provider") as HTMLSelectElement;
const apiKey=document.querySelector("#api-key") as HTMLInputElement;
const fastModel=document.querySelector("#fast-model") as HTMLInputElement;
const reasoningModel=document.querySelector("#reasoning-model") as HTMLInputElement;
const budget=document.querySelector("#budget") as HTMLInputElement;
const endpoints={digitalocean:"https://inference.do-ai.run",openai:"https://api.openai.com"} as const;

document.querySelector("#live")?.addEventListener("click",()=>send("START_LIVE"));
document.querySelector("#fixture")?.addEventListener("click",()=>send("START_FIXTURE"));
document.querySelector("#stop")?.addEventListener("click",()=>send("STOP"));
document.querySelector("#save-provider")?.addEventListener("click",()=>void saveProvider());
document.querySelector("#delete-provider")?.addEventListener("click",()=>void deleteProvider());
document.querySelector("#test-provider")?.addEventListener("click",()=>void testProvider());
provider.addEventListener("change",()=>loadDefaults());

async function send(type:string):Promise<void>{
  if(statusNode)statusNode.textContent=type==="STOP"?"Stopping…":"Starting…";
  const response=await chrome.runtime.sendMessage({type});
  if(statusNode)statusNode.textContent=response?.ok?"Ready":response?.error??"Unable to continue";
}

function values(){
  const baseUrl=endpoints[provider.value as keyof typeof endpoints];
  const limit=Number(budget.value);
  if(!apiKey.value.trim()||!fastModel.value.trim()||!reasoningModel.value.trim())throw new Error("Key and both model IDs are required.");
  if(!Number.isFinite(limit)||limit<=0)throw new Error("Enter a positive monthly guard.");
  return {baseUrl,apiKey:apiKey.value.trim(),model:fastModel.value.trim(),reasoningModel:reasoningModel.value.trim(),monthlyLimit:limit,provider:provider.value};
}

async function saveProvider(){
  try{const config=values();await chrome.storage.local.set({verityProvider:config});apiKey.value="";setProviderStatus("Saved locally. Verity will never display the key again.")}catch(error){setProviderStatus(safe(error))}
}
async function deleteProvider(){await chrome.storage.local.remove(["verityProvider","verityUsageLedger"]);apiKey.value="";setProviderStatus("Key, models, and usage ledger deleted.")}
async function testProvider(){
  try{
    const config=values();setProviderStatus("Testing…");
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5_000);
    const response=await fetch(`${config.baseUrl}/v1/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},signal:controller.signal,body:JSON.stringify({model:config.model,max_tokens:1,messages:[{role:"user",content:"Reply OK"}]})});clearTimeout(timer);
    if(response.status===401||response.status===403)throw new Error("Authentication or model permission failed.");
    if(response.status===429)throw new Error("Provider rate limit reached.");
    if(!response.ok)throw new Error(`Provider compatibility test failed (${response.status}).`);
    setProviderStatus("Connection passed. Save to use this configuration.");
  }catch(error){setProviderStatus(error instanceof DOMException&&error.name==="AbortError"?"Provider test timed out.":safe(error))}
}
function loadDefaults(){if(provider.value==="digitalocean"){fastModel.value="llama3.3-70b-instruct";reasoningModel.value="gpt-oss-120b"}else{fastModel.value="gpt-4.1-mini";reasoningModel.value="gpt-5-mini"}}
function setProviderStatus(value:string){if(providerStatus)providerStatus.textContent=value}
function safe(error:unknown){return error instanceof Error?error.message.slice(0,160):"Unable to save settings."}
void chrome.storage.local.get("verityProvider").then(({verityProvider})=>{if(!verityProvider){loadDefaults();return}provider.value=verityProvider.provider??"digitalocean";fastModel.value=verityProvider.model??"";reasoningModel.value=verityProvider.reasoningModel??"";budget.value=String(verityProvider.monthlyLimit??10)});
