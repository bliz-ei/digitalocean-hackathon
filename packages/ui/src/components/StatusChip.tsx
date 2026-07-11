/* The overlay status vocabulary. Exact names are locked by DESIGN.md §7. */
export type StatusState="Idle"|"Listening"|"Transcribing"|"Checking"|"Completed"|"Could not verify";

const active=new Set<StatusState>(["Listening","Transcribing","Checking"]);

export function StatusChip({state}:{state:StatusState}){
  const modifier=state==="Completed"?" vy-status-chip--completed"
    :state==="Could not verify"?" vy-status-chip--failed"
    :active.has(state)?" vy-status-chip--active":"";
  return <span className={`vy-status-chip${modifier}`} role="status">
    <span className="vy-status-chip__dot"/>
    {state}
  </span>;
}
