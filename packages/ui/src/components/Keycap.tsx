import type {ReactNode} from "react";

export function Keycap({children}:{children:ReactNode}){
  return <kbd className="vy-keycap">{children}</kbd>;
}
