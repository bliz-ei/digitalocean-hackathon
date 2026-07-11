import {useEffect, useRef, useState, type ElementType, type ReactNode} from "react";

/** True when the visitor asked the OS to reduce motion. Read once; the value is
 *  stable for the session (we don't hot-swap animation state mid-visit). */
export function prefersReducedMotion():boolean{
  return typeof window!=="undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches===true;
}

/** Scroll-reveal wrapper (aside pattern): children start faded + shifted down and
 *  settle into place the first time the element crosses into the viewport. The reveal
 *  is one-shot — it never re-hides on scroll-up. `delay` staggers siblings. Under
 *  prefers-reduced-motion the element renders in its final state immediately with no
 *  observer and no transition. */
export function Reveal({
  children, as:Tag="div", className="", delay=0, ...rest
}:{
  children:ReactNode; as?:ElementType; className?:string; delay?:number;
}&Record<string,unknown>){
  const reduced=useRef(prefersReducedMotion()).current;
  const ref=useRef<HTMLElement|null>(null);
  const [shown,setShown]=useState(reduced);

  useEffect(()=>{
    if(reduced||shown)return;
    const el=ref.current;
    if(!el)return;
    if(typeof IntersectionObserver==="undefined"){setShown(true);return;}
    const io=new IntersectionObserver((entries)=>{
      for(const entry of entries){
        if(entry.isIntersecting){setShown(true);io.disconnect();break;}
      }
    },{rootMargin:"0px 0px -8% 0px",threshold:0.08});
    io.observe(el);
    return ()=>io.disconnect();
  },[reduced,shown]);

  return (
    <Tag
      ref={ref}
      className={`web-reveal${shown?" is-in":""}${className?` ${className}`:""}`}
      style={delay&&!reduced?{transitionDelay:`${delay}ms`}:undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
