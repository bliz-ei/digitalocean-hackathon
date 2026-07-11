import type {ClaimCandidate, SynthesisRequest, WsEnvelope} from "@verity/contracts";
import {AudioTransport} from "./audio-transport";
import {classify, synthesize, type ProviderConfig} from "./classifier";

type StartMessage = {type:"OFFSCREEN_START";streamId:string;sessionId:string;credential:string;provider?:ProviderConfig};

let stream: MediaStream|undefined;
let recorder: MediaRecorder|undefined;
let context: AudioContext|undefined;
let transport: AudioTransport|undefined;
let startedAt=0;

chrome.runtime.onMessage.addListener((message:StartMessage|{type:"OFFSCREEN_STOP"},_sender,reply)=>{
  if(message.type==="OFFSCREEN_START"){
    void start(message).then(()=>reply({ok:true})).catch(error=>{void publish({type:"capture_error",payload:{message:safeError(error)}});reply({ok:false,error:safeError(error)})});
    return true;
  }
  if(message.type==="OFFSCREEN_STOP"){stop();reply({ok:true})}
});

async function start(message:StartMessage):Promise<void>{
  if(stream) throw new Error("Verity is already capturing a tab.");
  stream=await navigator.mediaDevices.getUserMedia({
    audio:{mandatory:{chromeMediaSource:"tab",chromeMediaSourceId:message.streamId}} as MediaTrackConstraints,
    video:false,
  });
  context=new AudioContext();
  await context.resume();
  context.createMediaStreamSource(stream).connect(context.destination);
  const mimeType=MediaRecorder.isTypeSupported("audio/webm;codecs=opus")?"audio/webm;codecs=opus":"audio/webm";
  recorder=new MediaRecorder(stream,{mimeType,audioBitsPerSecond:64_000});
  const socketUrl=`ws://localhost:8000/v1/sessions/${encodeURIComponent(message.sessionId)}/stream?credential=${encodeURIComponent(message.credential)}`;
  const channels=stream.getAudioTracks()[0]?.getSettings().channelCount??1;
  transport=new AudioTransport(socketUrl,message.streamId,message.provider?"client":"server",event=>handleEvent(event,message.provider),undefined,12,context.sampleRate,channels);
  transport.connect();
  startedAt=performance.now();
  recorder.ondataavailable=event=>{if(event.data.size)void transport?.enqueue(event.data,Math.round(performance.now()-startedAt)).catch(error=>{void publish({type:"capture_error",payload:{message:safeError(error)}});stop()})};
  recorder.onerror=()=>{void publish({type:"capture_error",payload:{message:"Audio encoding failed. Stop and retry."}});stop()};
  stream.getAudioTracks()[0]?.addEventListener("ended",()=>{void publish({type:"capture_error",payload:{message:"Tab audio ended. Stop and restart Verity."}});stop()},{once:true});
  recorder.start(1_000);
}

async function handleEvent(event:WsEnvelope,provider?:ProviderConfig):Promise<void>{
  await publish(event);
  if(event.type==="classification_request"&&provider){
    try{transport?.sendClassification(await classify(event.payload as unknown as ClaimCandidate,provider))}
    catch(error){await publish({type:"classification_failed",payload:{message:safeError(error)}})}
  }
  if(event.type==="synthesis_request"&&provider){
    try{transport?.sendVerdict(await synthesize(event.payload as unknown as SynthesisRequest,provider))}
    catch(error){await publish({type:"synthesis_failed",payload:{message:safeError(error)}})}
  }
}

async function publish(event:Pick<WsEnvelope,"type"|"payload">):Promise<void>{
  await chrome.runtime.sendMessage({type:"LIVE_EVENT",event}).catch(()=>undefined);
}

function stop():void{
  if(recorder?.state!=="inactive")recorder?.stop();
  transport?.stop();
  for(const track of stream?.getTracks()??[])track.stop();
  void context?.close();
  stream=undefined;recorder=undefined;transport=undefined;context=undefined;
}

function safeError(error:unknown):string{return error instanceof Error?error.message.slice(0,180):"Unexpected capture error"}
