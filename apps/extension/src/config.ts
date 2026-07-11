/// <reference types="vite/client" />
export const apiBase=(import.meta.env.VITE_API_URL??"http://localhost:8000").replace(/\/$/,"");
export function websocketBase():string{return apiBase.replace(/^https:/,"wss:").replace(/^http:/,"ws:")}

/** Base URL of the Verity pairing PWA. The popup builds the iPhone pairing QR as
 *  `${pwaBaseUrl}/?pair=<redemption_token>`. There is no deployed PWA URL committed
 *  in this repo yet, so this defaults to the local dev server — change this one
 *  constant (or set VITE_PWA_URL) when the PWA is deployed. */
export const pwaBaseUrl=(import.meta.env.VITE_PWA_URL??"http://localhost:5173").replace(/\/$/,"");
