import type {CSSProperties} from "react";

/* Verity mark: a bold, tight hollow circle holding the verdict check, with the
   cited-source underline as a separate accent below the ring (outline-logo restyle).
   Ring and strokes read ink via currentColor over a white disc, matching the icons. */
function Glyph({size}:{size:number}){
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
    <circle cx="16" cy="12.75" r="8.5" fill="#ffffff" stroke="currentColor" strokeWidth="2.8"/>
    <path d="M10.75 12.75l3.5 3.5L22.5 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 26h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
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
