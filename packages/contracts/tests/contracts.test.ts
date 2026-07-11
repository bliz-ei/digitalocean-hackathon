import {describe,expect,it} from "vitest";
import {claimStates} from "../src/index";
describe("contracts",()=>{it("preserves canonical state order",()=>expect(claimStates.slice(0,7)).toEqual(["CAPTURING","TRANSCRIBING","CLAIM_CANDIDATE","CHECKING","EVIDENCE_READY","SYNTHESIZING","COMPLETE"]));});
