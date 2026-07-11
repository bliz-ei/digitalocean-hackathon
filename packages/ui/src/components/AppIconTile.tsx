import type {CSSProperties, ReactNode} from "react";

export function AppIconTile({size="md",children,label,style}:{size?:"md"|"lg";children?:ReactNode;label?:string;style?:CSSProperties}){
  return <span className={`vy-tile${size==="lg"?" vy-tile--lg":""}`} role={label?"img":undefined} aria-label={label} style={style}>{children}</span>;
}
