/* Minimal in-memory `chrome` stub for the dev harness (screenshots only). Import this
 * module FIRST — before any src module that touches chrome.* — so the global exists.
 * NOT part of the extension build (dev/ is excluded from vite.config inputs). */

type Listener=(changes:Record<string,{oldValue?:unknown;newValue?:unknown}>,area:string)=>void;
type Store=Record<string,unknown>;

const local:Store={};                                    // no verityProvider → popup shows the Demo key chip
const session:Store={overlayState:{mode:"live",connection:"CONNECTED",transcripts:[{segment_id:"d1",speaker:"B",text:"Electric vehicles produce no carbon emissions.",start_ms:12000,end_ms:15400,is_final:true}],sessionId:"dev-session"}};
const listeners:Listener[]=[];

function pick(store:Store,keys:unknown):Store{
  if(keys==null)return {...store};
  if(typeof keys==="string")return {[keys]:store[keys]};
  if(Array.isArray(keys)){const out:Store={};for(const k of keys)out[k]=store[k];return out;}
  const out:Store={};for(const k of Object.keys(keys as object))out[k]=store[k]??(keys as Store)[k];return out;
}
function makeArea(store:Store,area:string){
  return {
    get:(keys:unknown)=>Promise.resolve(pick(store,keys)),
    set:(obj:Store)=>{const changes:Record<string,{newValue:unknown}>={};for(const k of Object.keys(obj)){store[k]=obj[k];changes[k]={newValue:obj[k]};}listeners.forEach(l=>l(changes,area));return Promise.resolve();},
    remove:(keys:string|string[])=>{for(const k of([] as string[]).concat(keys))delete store[k];return Promise.resolve();},
  };
}

const challenge={challenge_id:"dev-challenge",code:"481920",redemption_token:"dev-redemption-token-4f2a91",expires_at:new Date(Date.now()+120000).toISOString()};

(globalThis as unknown as {chrome:unknown}).chrome={
  storage:{
    local:makeArea(local,"local"),
    session:makeArea(session,"session"),
    onChanged:{addListener:(l:Listener)=>listeners.push(l),removeListener:(l:Listener)=>{const i=listeners.indexOf(l);if(i>=0)listeners.splice(i,1);}},
  },
  runtime:{
    sendMessage:(message:{type:string})=>{
      if(message.type==="PAIR_PHONE")return Promise.resolve({ok:true,challenge});
      return Promise.resolve({ok:true});
    },
    openOptionsPage:()=>{console.log("[stub] openOptionsPage");},
    getURL:(path:string)=>path,
    onMessage:{addListener:()=>undefined,removeListener:()=>undefined},
  },
};

export {};
