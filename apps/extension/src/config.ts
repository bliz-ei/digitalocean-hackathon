/// <reference types="vite/client" />
export const apiBase=(import.meta.env.VITE_API_URL??"http://localhost:8000").replace(/\/$/,"");
export function websocketBase():string{return apiBase.replace(/^https:/,"wss:").replace(/^http:/,"ws:")}
