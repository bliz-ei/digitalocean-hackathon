/* Shadow-DOM stylesheet delivery.
 *
 * verityCss is the complete design-system stylesheet (tokens + base + every
 * component rule) as a single string, so it can be adopted into a shadow root
 * where the page's own <style>/<link> tags do not cross the boundary:
 *
 *   const sheet = new CSSStyleSheet();
 *   sheet.replaceSync(verityCss);
 *   shadowRoot.adoptedStyleSheets = [sheet];
 *
 * Fonts are delivered separately: page contexts import fonts.css; shadow / MV3
 * contexts (where relative url() cannot resolve) inject interFontFaceCss(baseUrl)
 * with an absolute URL from chrome.runtime.getURL("Inter-latin.woff2")'s directory.
 */
import tokens from "./tokens.css?inline";
import base from "./base.css?inline";
import components from "./components/components.css?inline";

export const verityCss=`${tokens}\n${base}\n${components}`;

/** @font-face CSS with an absolute woff2 URL. Pass the directory that serves
 *  Inter-latin.woff2 (e.g. chrome.runtime.getURL("") or a CDN base). */
export function interFontFaceCss(baseUrl:string):string{
  const url=`${baseUrl.replace(/\/+$/,"")}/Inter-latin.woff2`;
  return `@font-face{font-family:"Inter";font-style:normal;font-weight:100 900;font-display:swap;src:url("${url}") format("woff2");}`;
}
