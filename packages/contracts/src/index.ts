export const claimStates = ["CAPTURING","TRANSCRIBING","CLAIM_CANDIDATE","CHECKING","EVIDENCE_READY","SYNTHESIZING","COMPLETE","INSUFFICIENT_EVIDENCE","FAILED"] as const;
export type ClaimState = typeof claimStates[number];
export type Evidence = {id:string; stance:"support"|"counter"|"context"; title:string; canonical_url:string; publisher:string; published_at:string|null; retrieved_at:string; excerpt:string; source_tier:"primary"|"research"|"established"|"other"; content_hash:string; query_role:"neutral"|"support"|"counter"; independent_key:string};
export type Verdict = {label:"Supported"|"Misleading"|"Disputed"|"Unsupported"|"Insufficient evidence"; confidence:number; explanation:string; uncertainty:string; counterevidence_summary:string; common_ground:string|null; citation_ids:string[]; model_provider:string; model_name:string; prompt_version:string};
export type VerdictDraft = Verdict & {claim_public_id:string; prompt_version:"phase3-v1"};
export type Claim = {public_id:string; session_id:string; speaker_label:string; exact_text:string; normalized_text:string; start_ms:number; end_ms:number; classification:"opinion"|"factual_claim"|"unverifiable"; state:ClaimState; created_at:string; completed_at:string|null; evidence:Evidence[]; verdict:Verdict|null; fixture_mode:boolean};
export type SessionCreated = {id:string; credential:string; fixture_mode:boolean};
export type PairingChallenge = {challenge_id:string; code:string; redemption_token:string; expires_at:string};
export type PairedDevice = {device_id:string; device_token:string; device_label:string; session_id:string};
export type PushRegistration = {subscription_id:string; device_id:string; active:boolean};
export type Speaker = string;
export type AudioChunkMetadata = {stream_id:string; chunk_sequence:number; captured_at_ms:number; duration_ms:number; mime_type:string; sample_rate:number; channels:number; byte_length:number};
export type TranscriptSegment = {segment_id:string; speaker:Speaker; text:string; start_ms:number; end_ms:number; is_final:boolean};
export type ClaimCandidate = {candidate_id:string; speaker:Speaker; exact_text:string; normalized_text:string; start_ms:number; end_ms:number; context_before:string};
export type ClassificationResult = {candidate_id:string; classification:"opinion"|"factual_claim"|"unverifiable"; normalized_claim:string|null; neutral_queries:string[]; support_queries:string[]; counter_queries:string[]; prompt_version:string; provider:string; model:string};
export type SynthesisRequest = {claim:Omit<Claim,"evidence"|"verdict">; evidence:Evidence[]; validation_errors:string[]; attempt:number; prompt_version:"phase3-v1"};
export type WsEnvelope<T=Record<string,unknown>> = {type:string; schema_version:"2"; session_id:string; sequence:number; payload:T};
export const api = {
  async createSession(baseUrl:string, fixtureMode=true):Promise<SessionCreated> { return request(`${baseUrl}/v1/sessions`, {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({idempotency_key:crypto.randomUUID(),fixture_mode:fixtureMode})}); },
  async startFixture(baseUrl:string, sessionId:string):Promise<Claim> { return request(`${baseUrl}/v1/sessions/${sessionId}/claims`, {method:"POST"}); },
  async getClaim(baseUrl:string, publicId:string):Promise<Claim> { return request(`${baseUrl}/v1/claims/${publicId}`); },
  async createPairing(baseUrl:string,sessionId:string):Promise<PairingChallenge> { return request(`${baseUrl}/v1/pairings`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({session_id:sessionId})}); },
  async redeemPairing(baseUrl:string,value:{code?:string;redemption_token?:string;device_label:string}):Promise<PairedDevice> { return request(`${baseUrl}/v1/pairings/redeem`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(value)}); },
  async pushConfig(baseUrl:string):Promise<{vapid_public_key:string;enabled:boolean}> { return request(`${baseUrl}/v1/push-config`); },
  async registerPush(baseUrl:string,value:{device_id:string;device_token:string;endpoint:string;p256dh:string;auth:string}):Promise<PushRegistration> { return request(`${baseUrl}/v1/push-subscriptions`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(value)}); },
  async revokePush(baseUrl:string,subscriptionId:string,deviceToken:string):Promise<void> { const response=await fetch(`${baseUrl}/v1/push-subscriptions/${subscriptionId}`,{method:"DELETE",headers:{"X-Verity-Device-Token":deviceToken}});if(!response.ok)throw new Error(`API ${response.status}`); }
};
async function request<T>(url:string, init?:RequestInit):Promise<T> { const response=await fetch(url,init); if(!response.ok) throw new Error(`API ${response.status}`); return response.json() as Promise<T>; }
