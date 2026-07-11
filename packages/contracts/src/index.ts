export const claimStates = ["CAPTURING","TRANSCRIBING","CLAIM_CANDIDATE","CHECKING","EVIDENCE_READY","SYNTHESIZING","COMPLETE","INSUFFICIENT_EVIDENCE","FAILED"] as const;
export type ClaimState = typeof claimStates[number];
export type Evidence = {id:string; stance:"support"|"counter"|"context"; title:string; canonical_url:string; publisher:string; published_at:string; retrieved_at:string; excerpt:string; source_tier:"primary"|"research"|"established"; content_hash:string};
export type Verdict = {label:"Supported"|"Misleading"|"Disputed"|"Unsupported"|"Insufficient evidence"; confidence:number; explanation:string; uncertainty:string; counterevidence_summary:string; common_ground:string|null; citation_ids:string[]; model_provider:string; model_name:string; prompt_version:string};
export type Claim = {public_id:string; session_id:string; speaker_label:string; exact_text:string; normalized_text:string; start_ms:number; end_ms:number; classification:"opinion"|"factual_claim"|"unverifiable"; state:ClaimState; created_at:string; completed_at:string|null; evidence:Evidence[]; verdict:Verdict|null; fixture_mode:boolean};
export type SessionCreated = {id:string; credential:string; fixture_mode:boolean};
export type Speaker = "A"|"B";
export type AudioChunkMetadata = {stream_id:string; chunk_sequence:number; captured_at_ms:number; duration_ms:number; mime_type:string; sample_rate:number; channels:number; byte_length:number};
export type TranscriptSegment = {segment_id:string; speaker:Speaker; text:string; start_ms:number; end_ms:number; is_final:boolean};
export type ClaimCandidate = {candidate_id:string; speaker:Speaker; exact_text:string; normalized_text:string; start_ms:number; end_ms:number; context_before:string};
export type ClassificationResult = {candidate_id:string; classification:"opinion"|"factual_claim"|"unverifiable"; normalized_claim:string|null; neutral_queries:string[]; support_queries:string[]; counter_queries:string[]; prompt_version:string; provider:string; model:string};
export type WsEnvelope<T=Record<string,unknown>> = {type:string; schema_version:"2"; session_id:string; sequence:number; payload:T};
export const api = {
  async createSession(baseUrl:string, fixtureMode=true):Promise<SessionCreated> { return request(`${baseUrl}/v1/sessions`, {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({idempotency_key:crypto.randomUUID(),fixture_mode:fixtureMode})}); },
  async startFixture(baseUrl:string, sessionId:string):Promise<Claim> { return request(`${baseUrl}/v1/sessions/${sessionId}/claims`, {method:"POST"}); },
  async getClaim(baseUrl:string, publicId:string):Promise<Claim> { return request(`${baseUrl}/v1/claims/${publicId}`); }
};
async function request<T>(url:string, init?:RequestInit):Promise<T> { const response=await fetch(url,init); if(!response.ok) throw new Error(`API ${response.status}`); return response.json() as Promise<T>; }
