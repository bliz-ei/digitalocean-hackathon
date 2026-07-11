import {useId, type InputHTMLAttributes} from "react";

export function TextInput({label,help,error,className,id,...rest}:InputHTMLAttributes<HTMLInputElement>&{label?:string;help?:string;error?:string}){
  const auto=useId();
  const inputId=id??auto;
  const describedBy=error?`${inputId}-error`:help?`${inputId}-help`:undefined;
  return <label className={`vy-field${error?" vy-field--error":""}${className?` ${className}`:""}`} htmlFor={inputId}>
    {label&&<span className="vy-field__label">{label}</span>}
    <input id={inputId} className="vy-field__input" aria-invalid={error?true:undefined} aria-describedby={describedBy} {...rest}/>
    {error?<span id={`${inputId}-error`} className="vy-field__error" role="alert">{error}</span>
      :help?<span id={`${inputId}-help`} className="vy-field__help">{help}</span>:null}
  </label>;
}
