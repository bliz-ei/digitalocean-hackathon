import type {CSSProperties} from "react";

/* Verity mark: a bold, tight hollow circle with the verdict check + cited-source
   underline layered on top, tips crossing the ring (outline-logo restyle). Ring and
   strokes read ink via currentColor over a white disc, matching the rasterized icons. */
function Glyph({size}:{size:number}){
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
    <circle cx="16" cy="16" r="9.2" fill="#ffffff" stroke="currentColor" strokeWidth="2.8"/>
    <path d="M10.75 14.25l3 3L22 10.25" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11 21.75h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>;
}

export function VerityMark({size=48,title="Verity",style}:{size?:number;title?:string;style?:CSSProperties}){
  return <span className="vy-mark" role="img" aria-label={title}
    style={{width:size,height:size,color:"var(--color-ink)",...style}}>
    <Glyph size={size}/>
  </span>;
}

export function VerityWordmark({size=32,label="Verity",style}:{size?:number;label?:string;style?:CSSProperties}){
  return <span className="vy-wordmark" style={style}>
    <VerityMark size={size} title={label}/>
    <span className="vy-wordmark__text">{label}</span>
  </span>;
}
