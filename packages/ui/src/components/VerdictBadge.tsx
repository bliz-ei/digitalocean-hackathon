import type {Verdict} from "@verity/contracts";

export type VerdictLabel=Verdict["label"];

const modifier:Record<VerdictLabel,string>={
  "Supported":"supported",
  "Misleading":"misleading",
  "Unsupported":"unsupported",
  "Disputed":"disputed",
  "Insufficient evidence":"insufficient"
};

export function VerdictBadge({label}:{label:VerdictLabel}){
  return <span className={`vy-verdict-badge vy-verdict-badge--${modifier[label]}`}>{label}</span>;
}
