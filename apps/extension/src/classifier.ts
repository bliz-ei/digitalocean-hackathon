import type {ClaimCandidate, ClassificationResult} from "@verity/contracts";

export type ProviderConfig = {baseUrl:string; apiKey:string; model:string};

const system = `Classify one transcript sentence as opinion, factual_claim, or unverifiable. Do not judge truth. For factual_claim only, return normalized_claim and 1-3 neutral_queries, support_queries, and counter_queries. Return JSON only.`;

export async function classify(candidate: ClaimCandidate, config: ProviderConfig): Promise<ClassificationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_500);
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method:"POST",
      headers:{"authorization":`Bearer ${config.apiKey}`,"content-type":"application/json"},
      signal:controller.signal,
      body:JSON.stringify({
        model:config.model,
        temperature:0,
        response_format:{type:"json_object"},
        messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(candidate)}],
      }),
    });
    if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
    const body = await response.json() as {choices?:Array<{message?:{content?:string}}>};
    const value = JSON.parse(body.choices?.[0]?.message?.content ?? "") as Partial<ClassificationResult>;
    return validate({...value,candidate_id:candidate.candidate_id,provider:new URL(config.baseUrl).host,model:config.model,prompt_version:"phase2-v1"});
  } finally {
    clearTimeout(timeout);
  }
}

function validate(value: Partial<ClassificationResult>): ClassificationResult {
  if (!value.candidate_id || !["opinion","factual_claim","unverifiable"].includes(String(value.classification))) throw new Error("Invalid classification response");
  const factual=value.classification==="factual_claim";
  const lists=[value.neutral_queries,value.support_queries,value.counter_queries];
  if (factual && (typeof value.normalized_claim!=="string" || lists.some(items=>!Array.isArray(items)||items.length<1||items.length>3))) throw new Error("Invalid factual claim response");
  if (!factual && (value.normalized_claim || lists.some(items=>Array.isArray(items)&&items.length))) throw new Error("Invalid non-factual response");
  return {
    candidate_id:value.candidate_id,
    classification:value.classification!,
    normalized_claim:factual ? value.normalized_claim! : null,
    neutral_queries:factual ? value.neutral_queries! : [],
    support_queries:factual ? value.support_queries! : [],
    counter_queries:factual ? value.counter_queries! : [],
    prompt_version:String(value.prompt_version),provider:String(value.provider),model:String(value.model),
  };
}
