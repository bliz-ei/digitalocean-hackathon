export type UsageLedger = {month:string;estimatedCost:number;requests:number};
export type BudgetDecision = {allowed:boolean;estimatedCost:number;remaining:number};

export function monthKey(date=new Date()):string{return date.toISOString().slice(0,7)}
export function estimateCost(inputChars:number,outputTokens=300,usdPerMillionTokens=1):number{
  const inputTokens=Math.ceil(Math.max(0,inputChars)/4);
  return ((inputTokens+outputTokens)/1_000_000)*usdPerMillionTokens;
}
export function decideBudget(ledger:UsageLedger|undefined,limit:number,cost:number,date=new Date()):BudgetDecision{
  const spent=ledger?.month===monthKey(date)?ledger.estimatedCost:0;
  const remaining=Math.max(0,limit-spent);
  return {allowed:Number.isFinite(limit)&&limit>0&&cost<=remaining,estimatedCost:cost,remaining};
}
