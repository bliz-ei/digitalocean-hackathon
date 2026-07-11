import type {ButtonHTMLAttributes} from "react";

export type ButtonVariant="primary"|"secondary"|"tertiary"|"install";

export function Button({variant="primary",className,type="button",...rest}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:ButtonVariant}){
  return <button type={type} className={`vy-btn vy-btn--${variant}${className?` ${className}`:""}`} {...rest}/>;
}
