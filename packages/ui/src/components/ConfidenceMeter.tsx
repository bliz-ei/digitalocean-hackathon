const SEGMENTS=10;

export function confidenceBand(confidence:number):"Low"|"Moderate"|"High"{
  if(confidence<0.4)return "Low";
  if(confidence<=0.7)return "Moderate";
  return "High";
}

export function ConfidenceMeter({confidence}:{confidence:number}){
  const clamped=Math.max(0,Math.min(1,confidence));
  const filled=Math.round(clamped*SEGMENTS);
  const pct=Math.round(clamped*100);
  return <div className="vy-confidence">
    <span className="vy-confidence__label">{confidenceBand(clamped)} confidence</span>
    <div className="vy-confidence__meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${confidenceBand(clamped)} confidence, ${pct}%`}>
      {Array.from({length:SEGMENTS},(_,i)=><span key={i} className={`vy-confidence__seg${i<filled?" vy-confidence__seg--on":""}`}/>)}
    </div>
    <span className="vy-confidence__caption">{pct}% model confidence</span>
  </div>;
}
