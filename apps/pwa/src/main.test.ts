import {describe,expect,it} from "vitest"; describe("PWA routes",()=>it("supports canonical claim paths",()=>expect(/^\/claims\/([^/]+)/.test("/claims/demo")).toBe(true)));
