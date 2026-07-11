import {describe,expect,it} from "vitest";
import {decideBudget,estimateCost,reserveBudget} from "./budget";

describe("budget guard",()=>{
  it("rejects a request that exceeds the remaining monthly limit",()=>{
    const result=decideBudget({month:"2026-07",estimatedCost:.99,requests:3},1,.02,new Date("2026-07-11T00:00:00Z"));
    expect(result.allowed).toBe(false);
  });
  it("starts a fresh ledger in a new calendar month",()=>{
    expect(decideBudget({month:"2026-06",estimatedCost:10,requests:4},1,.02,new Date("2026-07-01T00:00:00Z")).allowed).toBe(true);
  });
  it("returns a conservative positive estimate",()=>expect(estimateCost(4_000,500,2)).toBeGreaterThan(0));
  it("charges every allowed request without charging a rejected request",()=>{
    const first=reserveBudget(undefined,1,.4,new Date("2026-07-11T00:00:00Z"));
    const second=reserveBudget(first.ledger,1,.4,new Date("2026-07-11T00:00:01Z"));
    const rejected=reserveBudget(second.ledger,1,.4,new Date("2026-07-11T00:00:02Z"));
    expect(first.decision.allowed).toBe(true);
    expect(second.ledger).toMatchObject({estimatedCost:.8,requests:2});
    expect(rejected.decision.allowed).toBe(false);
    expect(rejected.ledger).toEqual(second.ledger);
  });
});
