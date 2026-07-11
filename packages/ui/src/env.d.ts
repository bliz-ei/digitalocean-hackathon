/* Ambient declarations for asset imports consumed as source by Vite bundlers. */
declare module "*.css" { const css: string; export default css; }
declare module "*.css?inline" { const css: string; export default css; }
declare module "*.css?raw" { const css: string; export default css; }
declare module "*.woff2" { const url: string; export default url; }
declare module "*.svg" { const url: string; export default url; }
declare module "*.svg?raw" { const svg: string; export default svg; }
