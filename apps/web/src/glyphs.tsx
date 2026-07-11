/* Small monochrome line glyphs for the "How it works" pipeline and trust cards.
   Stroke uses currentColor so each glyph inherits the surrounding text color — no
   saturated accent leaks onto chrome (DESIGN.md: accents live only in badges). */
import type {ReactNode} from "react";

function Svg({children}:{children:ReactNode}){
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>;
}

export function GlyphListen(){
  return <Svg><path d="M3 12a9 9 0 0 1 18 0"/><rect x="3" y="12" width="4" height="7" rx="1.5"/><rect x="17" y="12" width="4" height="7" rx="1.5"/></Svg>;
}
export function GlyphTranscribe(){
  return <Svg><path d="M4 8h10"/><path d="M4 12h13"/><path d="M4 16h7"/><path d="M20 6v8"/></Svg>;
}
export function GlyphDetect(){
  return <Svg><path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/><circle cx="18.5" cy="18" r="2.2"/></Svg>;
}
export function GlyphWeigh(){
  return <Svg><path d="M12 4v15"/><path d="M6 19h12"/><path d="M12 6 5 9l2.4 4A3 3 0 0 1 5 13"/><path d="M12 6l7 3-2.4 4A3 3 0 0 0 19 13"/></Svg>;
}
export function GlyphVerdict(){
  return <Svg><path d="m4 12 4 4 8-9"/><path d="M8 20h9"/></Svg>;
}
export function GlyphTiers(){
  return <Svg><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/></Svg>;
}
export function GlyphSeparate(){
  return <Svg><rect x="3" y="4" width="7.5" height="16" rx="1.5"/><rect x="13.5" y="4" width="7.5" height="16" rx="1.5"/></Svg>;
}
export function GlyphCited(){
  return <Svg><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4"/><path d="m8.5 14 1.8 1.8L14 12"/></Svg>;
}
