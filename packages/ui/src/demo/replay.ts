import type {TimelineEvent} from "./timeline";

export type ReplayOptions={speed?:number;loop?:boolean};

/* Fire each timeline event at its relative offset (scaled by `speed`). Returns a
 * cancel function that clears every pending timer. With `loop`, the sequence
 * restarts after a short gap. Powers the marketing hero, dev-without-backend, and
 * the disclosed demo-fallback mode. */
export function replayTimeline<T>(events:TimelineEvent<T>[],onEvent:(envelope:T)=>void,opts:ReplayOptions={}):()=>void{
  const speed=opts.speed&&opts.speed>0?opts.speed:1;
  const timers:ReturnType<typeof setTimeout>[]=[];
  let cancelled=false;
  const total=events.length?Math.max(...events.map(event=>event.at)):0;
  function run(){
    for(const event of events){
      timers.push(setTimeout(()=>{if(!cancelled)onEvent(event.envelope);},event.at/speed));
    }
    if(opts.loop){
      timers.push(setTimeout(run,(total+900)/speed));
    }
  }
  run();
  return ()=>{cancelled=true;for(const timer of timers)clearTimeout(timer);timers.length=0;};
}
