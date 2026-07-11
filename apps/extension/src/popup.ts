const statusNode=document.querySelector("#status");
document.querySelector("#live")?.addEventListener("click",()=>send("START_LIVE"));
document.querySelector("#fixture")?.addEventListener("click",()=>send("START_FIXTURE"));
document.querySelector("#stop")?.addEventListener("click",()=>send("STOP"));

async function send(type:string):Promise<void>{
  if(statusNode)statusNode.textContent=type==="STOP"?"Stopping…":"Starting…";
  const response=await chrome.runtime.sendMessage({type});
  if(statusNode)statusNode.textContent=response?.ok?"Ready":response?.error??"Unable to continue";
}
