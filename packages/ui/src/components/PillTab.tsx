import type {ButtonHTMLAttributes} from "react";

export function PillTab({active=false,className,type="button",...rest}:ButtonHTMLAttributes<HTMLButtonElement>&{active?:boolean}){
  return <button type={type} aria-pressed={active} className={`vy-pill${active?" vy-pill--active":""}${className?` ${className}`:""}`} {...rest}/>;
}
