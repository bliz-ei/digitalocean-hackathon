export type UsageLedger = {month:string;estimatedCost:number;requests:number};
export type BudgetDecision = {allowed:boolean;estimatedCost:number;remaining:number};
export type BudgetReservation = {decision:BudgetDecision;ledger:UsageLedger};

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
export function reserveBudget(ledger:UsageLedger|undefined,limit:number,cost:number,date=new Date()):BudgetReservation{
  const decision=decideBudget(ledger,limit,cost,date);
  const currentMonth=monthKey(date);
  const spent=ledger?.month===currentMonth?ledger.estimatedCost:0;
  const requests=ledger?.month===currentMonth?ledger.requests:0;
  return {decision,ledger:{month:currentMonth,estimatedCost:spent+(decision.allowed?cost:0),requests:requests+(decision.allowed?1:0)}};
}
