import {afterEach,describe,expect,it,vi} from "vitest";
import {heroTimeline,heroClaim} from "./timeline";
import {replayTimeline} from "./replay";
import {confidenceBand} from "../components/ConfidenceMeter";

describe("heroTimeline",()=>{
  it("ends on a completed Misleading verdict with three citations",()=>{
    const last=heroTimeline[heroTimeline.length-1];
    expect(last.envelope.type).toBe("verdict_complete");
    expect(last.envelope.schema_version).toBe("2");
    expect(heroClaim.verdict?.label).toBe("Misleading");
    expect(heroClaim.verdict?.confidence).toBe(0.78);
    expect(heroClaim.verdict?.citation_ids).toHaveLength(3);
    expect(heroClaim.verdict?.common_ground).toBe("Everyone agrees EVs remove tailpipe emissions from streets.");
  });
  it("has monotonically increasing offsets and sequences",()=>{
    for(let i=1;i<heroTimeline.length;i++){
      expect(heroTimeline[i].at).toBeGreaterThanOrEqual(heroTimeline[i-1].at);
      expect(heroTimeline[i].envelope.sequence).toBeGreaterThan(heroTimeline[i-1].envelope.sequence);
    }
  });
});

describe("replayTimeline",()=>{
  afterEach(()=>vi.useRealTimers());
  it("fires every event at its scaled offset and cancels cleanly",()=>{
    vi.useFakeTimers();
    const seen:string[]=[];
    const cancel=replayTimeline(heroTimeline,env=>seen.push(env.type),{speed:2});
    vi.advanceTimersByTime(heroTimeline[heroTimeline.length-1].at/2+1);
    expect(seen).toHaveLength(heroTimeline.length);
    cancel();
    vi.advanceTimersByTime(100000);
    expect(seen).toHaveLength(heroTimeline.length);
  });
});

describe("confidenceBand",()=>{
  it("maps the locked bands",()=>{
    expect(confidenceBand(0.2)).toBe("Low");
    expect(confidenceBand(0.4)).toBe("Moderate");
    expect(confidenceBand(0.7)).toBe("Moderate");
    expect(confidenceBand(0.78)).toBe("High");
  });
});
