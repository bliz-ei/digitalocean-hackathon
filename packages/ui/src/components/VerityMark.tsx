import type {CSSProperties} from "react";

/* Minimal checkmark-with-citation motif: a verdict check above a cited source line.
   Strokes inherit currentColor so the mark reads white on the deep-ink brand tile (v2 §3). */
function Glyph({size}:{size:number}){
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
    <path d="M8 15.5l4.5 4.5L24 8.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11 24.5h10" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}

export function VerityMark({size=48,title="Verity",style}:{size?:number;title?:string;style?:CSSProperties}){
  const inner=Math.round(size*0.58);
  return <span className={`vy-mark vy-tile vy-tile--brand${size>=64?" vy-tile--lg":""}`} role="img" aria-label={title}
    style={{width:size,height:size,...style}}>
    <Glyph size={inner}/>
  </span>;
}

export function VerityWordmark({size=32,label="Verity",style}:{size?:number;label?:string;style?:CSSProperties}){
  return <span className="vy-wordmark" style={style}>
    <VerityMark size={size} title={label}/>
    <span className="vy-wordmark__text">{label}</span>
  </span>;
}
