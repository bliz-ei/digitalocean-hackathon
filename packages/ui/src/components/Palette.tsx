import type {ReactNode} from "react";

export function PaletteCard({title,dots=false,glass=false,children}:{title?:string;dots?:boolean;glass?:boolean;children:ReactNode}){
  return <div className={`vy-palette${glass?" vy-palette--glass":""}`}>
    {(title||dots)&&<div className="vy-palette__header">
      {dots&&<span className="vy-palette__dots"><span className="vy-palette__dot"/><span className="vy-palette__dot"/><span className="vy-palette__dot"/></span>}
      {title&&<span className="vy-palette__title">{title}</span>}
    </div>}
    <div className="vy-palette__body">{children}</div>
  </div>;
}

export function PaletteRow({icon,label,keycap,active=false,onClick}:{icon?:ReactNode;label:string;keycap?:ReactNode;active?:boolean;onClick?:()=>void}){
  return <button type="button" className={`vy-row${active?" vy-row--active":""}`} onClick={onClick}>
    {icon&&<span className="vy-row__icon">{icon}</span>}
    <span className="vy-row__label">{label}</span>
    {keycap&&<span className="vy-row__key">{keycap}</span>}
  </button>;
}
