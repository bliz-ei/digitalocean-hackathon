import {api,type Claim,type TranscriptSegment} from "@verity/contracts";
import type {ProviderConfig} from "./classifier";

const base="http://localhost:8000";
type OverlayState={mode:"fixture"|"live";connection:string;transcripts:TranscriptSegment[];claim?:Claim;error?:string};

chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
  if(message.type==="START_FIXTURE"){
    void startFixture().then(()=>reply({ok:true})).catch(error=>reply({ok:false,error:safeError(error)}));return true;
  }
  if(message.type==="START_LIVE"){
    void startLive().then(()=>reply({ok:true})).catch(async error=>{await update({error:safeError(error),connection:"ERROR"});reply({ok:false,error:safeError(error)})});return true;
  }
  if(message.type==="STOP"){
    void stop().then(()=>reply({ok:true}));return true;
  }
  if(message.type==="LIVE_EVENT"){
    void consume(message.event);reply({ok:true});
  }
});

async function startFixture():Promise<void>{
  const session=await api.createSession(base);
  const claim=await api.startFixture(base,session.id);
  await update({mode:"fixture",connection:"COMPLETE",transcripts:[],claim});
}

async function startLive():Promise<void>{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab.id||!tab.url?.startsWith("https://www.youtube.com/"))throw new Error("Open a YouTube video in the active tab first.");
  if(!/^Chrome\//.test(navigator.userAgent))throw new Error("Live capture requires Chrome 116 or newer.");
  const session=await api.createSession(base,false);
  const streamId=await new Promise<string>((resolve,reject)=>chrome.tabCapture.getMediaStreamId({targetTabId:tab.id},value=>{
    const error=chrome.runtime.lastError;
    if(error||!value)reject(new Error(error?.message??"Chrome did not provide a tab stream."));else resolve(value);
  }));
  await ensureOffscreen();
  const stored=await chrome.storage.local.get(["verityProvider"]);
  const provider=validProvider(stored.verityProvider)?stored.verityProvider:undefined;
  const response=await chrome.runtime.sendMessage({type:"OFFSCREEN_START",streamId,sessionId:session.id,credential:session.credential,provider});
  if(!response?.ok)throw new Error(response?.error??"Unable to start tab capture.");
  await update({mode:"live",connection:"CONNECTING",transcripts:[]});
}

async function consume(event:{type:string;payload:Record<string,unknown>}):Promise<void>{
  const state=await current();
  if(event.type==="capture_state")state.connection=String(event.payload.state);
  if(event.type==="heartbeat_ack")state.connection="CONNECTED";
  if(event.type==="transcript_final")state.transcripts=[...state.transcripts,event.payload as unknown as TranscriptSegment].slice(-8);
  if(event.type==="claim_state"&&event.payload.claim)state.claim=event.payload.claim as unknown as Claim;
  if(event.type.endsWith("failed")||event.type==="capture_error")state.error=String(event.payload.message??event.payload.reason??"Verity could not continue.");
  await update(state);
}

async function stop():Promise<void>{
  await chrome.runtime.sendMessage({type:"OFFSCREEN_STOP"}).catch(()=>undefined);
  await chrome.storage.session.remove("overlayState");
  await broadcast({type:"STOP"});
}

async function ensureOffscreen():Promise<void>{
  if(await chrome.offscreen.hasDocument())return;
  await chrome.offscreen.createDocument({url:"offscreen.html",reasons:[chrome.offscreen.Reason.USER_MEDIA],justification:"Capture and preserve audible user-selected tab audio"});
}

async function current():Promise<OverlayState>{
  const {overlayState}=await chrome.storage.session.get("overlayState");
  return overlayState??{mode:"live",connection:"CONNECTING",transcripts:[]};
}

async function update(state:Partial<OverlayState>):Promise<void>{
  const next={...await current(),...state};
  await chrome.storage.session.set({overlayState:next});
  await broadcast({type:"OVERLAY_STATE",state:next});
}

async function broadcast(message:unknown):Promise<void>{
  for(const tab of await chrome.tabs.query({url:"https://www.youtube.com/*"}))if(tab.id)await chrome.tabs.sendMessage(tab.id,message).catch(()=>undefined);
}

function validProvider(value:unknown):value is ProviderConfig{
  if(!value||typeof value!=="object")return false;
  const item=value as Record<string,unknown>;
  if(typeof item.baseUrl!=="string"||typeof item.apiKey!=="string"||typeof item.model!=="string")return false;
  try{return ["https://api.openai.com","https://inference.do-ai.run"].includes(new URL(item.baseUrl).origin)}catch{return false}
}
function safeError(error:unknown):string{return error instanceof Error?error.message.slice(0,180):"Unexpected Verity error"}
