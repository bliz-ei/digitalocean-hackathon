import {afterEach,describe,expect,it,vi} from "vitest";
import {synthesize} from "./classifier";
import type {SynthesisRequest} from "@verity/contracts";

afterEach(()=>vi.unstubAllGlobals());

describe("BYOK reasoning",()=>{
  it("returns only the strict structured verdict draft",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({
      ok:true,
      json:async()=>({choices:[{message:{content:JSON.stringify({
        label:"Misleading",confidence:.8,explanation:"Direct emissions are zero. Lifecycle emissions remain.",
        uncertainty:"Totals vary.",counterevidence_summary:"Production creates emissions.",common_ground:null,
        citation_ids:["a","b"],
      })}}]}),
    }));
    const request={
      claim:{public_id:"claim",session_id:"session",speaker_label:"Speaker A",exact_text:"Claim.",normalized_text:"Claim",start_ms:1,end_ms:2,classification:"factual_claim",state:"SYNTHESIZING",created_at:new Date().toISOString(),completed_at:null,fixture_mode:false},
      evidence:[],validation_errors:[],attempt:1,prompt_version:"phase3-v1",
    } satisfies SynthesisRequest;
    const result=await synthesize(request,{baseUrl:"https://api.openai.com",apiKey:"secret",model:"fast-model",reasoningModel:"reasoning-model"});
    expect(result).toMatchObject({claim_public_id:"claim",prompt_version:"phase3-v1",citation_ids:["a","b"],model_name:"reasoning-model"});
    const call=vi.mocked(fetch).mock.calls[0];
    expect(String(call[1]?.body)).not.toContain("secret");
    expect(JSON.parse(String(call[1]?.body)).model).toBe("reasoning-model");
  });
});
