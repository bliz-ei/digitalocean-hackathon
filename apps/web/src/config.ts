/** Marketing-site outbound links. Single source of truth so the demo-verdict deep
 *  link and store CTA are defined once. The PWA base URL defaults to the local dev
 *  server; override with VITE_PWA_URL at build time for a deployed environment. */

export const PWA_BASE_URL = import.meta.env.VITE_PWA_URL ?? "http://localhost:5173";

/** Deep link to the disclosed demo verdict on the paired PWA. */
export const DEMO_VERDICT_URL = `${PWA_BASE_URL}/claims/demo`;

/** Chrome Web Store listing. Placeholder until the extension is published. */
export const CHROME_STORE_URL = "#";

/** Project repository (hackathon placeholder). */
export const GITHUB_URL = "https://github.com/mohammedwasif-netizen";
