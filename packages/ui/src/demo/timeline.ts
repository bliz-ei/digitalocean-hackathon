import type {Claim, ClaimState, Evidence, TranscriptSegment, Verdict, WsEnvelope} from "@verity/contracts";

/* Typed replay of the hero demo as WebSocket envelopes. The event `type` strings,
 * `schema_version`, and payload shapes mirror the live pipeline (transcript_final,
 * claim_state, pipeline_state, verdict_complete). Data is a disclosed fixture:
 * plausible, human-checkable sources — never a measured provider result. */

const SESSION_ID="hero-demo-session";
const RETRIEVED_AT="2026-07-11T16:30:05Z";

const evidence:Evidence[]=[
  {
    id:"epa-ev-myths",
    stance:"context",
    title:"Electric Vehicle Myths",
    canonical_url:"https://www.epa.gov/greenvehicles/electric-vehicle-myths",
    publisher:"U.S. Environmental Protection Agency",
    published_at:"2025-03-18T00:00:00Z",
    retrieved_at:RETRIEVED_AT,
    excerpt:"EVs produce zero tailpipe emissions, and typically have a smaller carbon footprint than gasoline cars even after accounting for electricity generation.",
    source_tier:"primary",
    content_hash:"epa-ev-myths-hash",
    query_role:"neutral",
    independent_key:"epa.gov"
  },
  {
    id:"iea-global-ev-outlook",
    stance:"support",
    title:"Global EV Outlook 2024",
    canonical_url:"https://www.iea.org/reports/global-ev-outlook-2024",
    publisher:"International Energy Agency",
    published_at:"2024-04-23T00:00:00Z",
    retrieved_at:RETRIEVED_AT,
    excerpt:"Battery-electric vehicles emit no exhaust gases at the point of use, removing tailpipe pollutants from roads and city centres.",
    source_tier:"established",
    content_hash:"iea-outlook-hash",
    query_role:"support",
    independent_key:"iea.org"
  },
  {
    id:"reuters-lifecycle",
    stance:"counter",
    title:"Factbox: How clean are electric vehicles over their lifetime?",
    canonical_url:"https://www.reuters.com/business/autos-transportation/how-clean-are-electric-vehicles-2023-06-29/",
    publisher:"Reuters",
    published_at:"2023-06-29T00:00:00Z",
    retrieved_at:RETRIEVED_AT,
    excerpt:"Manufacturing an EV, especially its battery, and generating the electricity it runs on still create greenhouse-gas emissions across the vehicle's life cycle.",
    source_tier:"established",
    content_hash:"reuters-lifecycle-hash",
    query_role:"counter",
    independent_key:"reuters.com"
  }
];

const verdict:Verdict={
  label:"Misleading",
  confidence:0.78,
  explanation:"EVs have no tailpipe emissions, but lifecycle emissions remain.",
  uncertainty:"The lifecycle total varies with battery manufacturing and the local electricity mix.",
  counterevidence_summary:"Zero tailpipe emissions does not mean zero lifecycle emissions: production and power generation still emit.",
  common_ground:"Everyone agrees EVs remove tailpipe emissions from streets.",
  citation_ids:["epa-ev-myths","iea-global-ev-outlook","reuters-lifecycle"],
  model_provider:"recorded",
  model_name:"hero-demo",
  prompt_version:"phase3-v1"
};

function claim(state:ClaimState,opts:{withEvidence?:boolean;withVerdict?:boolean}={}):Claim{
  return {
    public_id:"hero-ev-lifecycle-2026",
    session_id:SESSION_ID,
    speaker_label:"Speaker B",
    exact_text:"Electric vehicles produce no carbon emissions.",
    normalized_text:"Electric vehicles produce no carbon emissions.",
    start_ms:12000,
    end_ms:15400,
    classification:"factual_claim",
    state,
    created_at:"2026-07-11T16:30:00Z",
    completed_at:opts.withVerdict?"2026-07-11T16:30:08Z":null,
    evidence:opts.withEvidence?evidence:[],
    verdict:opts.withVerdict?verdict:null,
    fixture_mode:true
  };
}

function transcript(segment_id:string,speaker:"A"|"B",text:string,start_ms:number,end_ms:number):TranscriptSegment{
  return {segment_id,speaker,text,start_ms,end_ms,is_final:true};
}

let seq=0;
function env<T>(type:string,payload:T):WsEnvelope<T>{
  return {type,schema_version:"2",session_id:SESSION_ID,sequence:++seq,payload};
}

export type HeroPayload=
  |TranscriptSegment
  |{public_id:string;state:ClaimState}
  |{public_id:string;state:ClaimState;claim:Claim};
export type HeroEnvelope=WsEnvelope<HeroPayload>;
export type TimelineEvent<T=HeroEnvelope>={at:number;envelope:T};

/** The hero demo timeline: transcript → claim detected → checking → completed Misleading.
 *  `at` is a relative offset in milliseconds from the start of the replay. */
export const heroTimeline:TimelineEvent[]=[
  {at:0,envelope:env<HeroPayload>("transcript_final",transcript("hero-1","A","I think electric cars look better.",8000,11200))},
  {at:1800,envelope:env<HeroPayload>("transcript_final",transcript("hero-2","B","Electric vehicles produce no carbon emissions.",12000,15400))},
  {at:2600,envelope:env<HeroPayload>("claim_state",{public_id:"hero-ev-lifecycle-2026",state:"CLAIM_CANDIDATE",claim:claim("CLAIM_CANDIDATE")})},
  {at:3200,envelope:env<HeroPayload>("pipeline_state",{public_id:"hero-ev-lifecycle-2026",state:"CHECKING",claim:claim("CHECKING")})},
  {at:5200,envelope:env<HeroPayload>("pipeline_state",{public_id:"hero-ev-lifecycle-2026",state:"EVIDENCE_READY",claim:claim("EVIDENCE_READY",{withEvidence:true})})},
  {at:6400,envelope:env<HeroPayload>("pipeline_state",{public_id:"hero-ev-lifecycle-2026",state:"SYNTHESIZING",claim:claim("SYNTHESIZING",{withEvidence:true})})},
  {at:8000,envelope:env<HeroPayload>("verdict_complete",{public_id:"hero-ev-lifecycle-2026",state:"COMPLETE",claim:claim("COMPLETE",{withEvidence:true,withVerdict:true})})}
];

/** The evidence, verdict, and completed claim as standalone fixtures for static rendering. */
export const heroEvidence=evidence;
export const heroVerdict=verdict;
export const heroClaim=claim("COMPLETE",{withEvidence:true,withVerdict:true});
