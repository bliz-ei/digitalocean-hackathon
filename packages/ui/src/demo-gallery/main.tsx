import {useEffect,useState,type ReactNode} from "react";
import {createRoot} from "react-dom/client";
import type {Claim} from "@verity/contracts";
import {
  Button,VerdictBadge,ConfidenceMeter,CitationCard,StatusChip,Keycap,AppIconTile,
  PillTab,TextInput,PaletteCard,PaletteRow,VerityMark,VerityWordmark,StatusCard,VerdictCard,
  heroClaim,heroEvidence,heroTimeline,replayTimeline,type StatusState,type HeroPayload
} from "../index";

function Section({title,children}:{title:string;children:ReactNode}){
  return <section style={{display:"flex",flexDirection:"column",gap:"var(--space-md)"}}>
    <h2 className="vy-heading-md" style={{color:"var(--color-mute)",textTransform:"uppercase",letterSpacing:"0.4px",fontSize:"var(--type-caption-sm-size)"}}>{title}</h2>
    <div style={{display:"flex",flexWrap:"wrap",gap:"var(--space-lg)",alignItems:"flex-start"}}>{children}</div>
  </section>;
}

const statuses:StatusState[]=["Idle","Listening","Transcribing","Checking","Completed","Could not verify"];

function LiveOverlayDemo(){
  const [claim,setClaim]=useState<Claim>();
  const [status,setStatus]=useState<StatusState>("Idle");
  const [lines,setLines]=useState<string[]>([]);
  useEffect(()=>{
    const cancel=replayTimeline<HeroPayload>(heroTimeline.map(e=>({at:e.at,envelope:e.envelope.payload})),(payload)=>{
      if("segment_id" in payload){setLines(prev=>[...prev,`Speaker ${payload.speaker}: ${payload.text}`]);setStatus("Transcribing");return;}
      if("claim" in payload){
        setClaim(payload.claim);
        setStatus(payload.state==="COMPLETE"?"Completed":payload.state==="CLAIM_CANDIDATE"?"Transcribing":"Checking");
      }
    },{loop:true,speed:1.4});
    return cancel;
  },[]);
  return <div className="vy-palette" style={{maxWidth:400}}>
    <div className="vy-palette__header"><StatusChip state={status}/></div>
    <div style={{padding:"var(--space-lg)",display:"flex",flexDirection:"column",gap:"var(--space-md)"}}>
      <ol style={{display:"flex",flexDirection:"column",gap:"var(--space-xs)",margin:0,padding:0,listStyle:"none"}}>
        {lines.map((line,i)=><li key={i} className="vy-body-sm" style={{color:"var(--color-body)"}}>{line}</li>)}
      </ol>
      {claim?.verdict?<VerdictCard claim={claim}/>:claim?<StatusCard state={claim.state} body="Verity is checking…"/>:null}
    </div>
  </div>;
}

function Gallery(){
  const [pill,setPill]=useState(0);
  return <main className="vy-root" style={{maxWidth:1120,margin:"0 auto",padding:"var(--space-xxl) var(--space-xl)",display:"flex",flexDirection:"column",gap:"var(--space-section)"}}>
    <header style={{display:"flex",flexDirection:"column",gap:"var(--space-lg)"}}>
      <VerityWordmark/>
      <h1 className="vy-display-lg">Verity Design System</h1>
      <p className="vy-body-lg" style={{color:"var(--color-body)",maxWidth:640}}>Every component in every state. Verity Glass — light canvas, frosted-glass floating surfaces, Inter with ss03; shadows only on glass.</p>
    </header>

    <Section title="Brand mark">
      <VerityMark size={48}/>
      <VerityMark size={64}/>
      <VerityWordmark/>
    </Section>

    <Section title="Buttons">
      <Button variant="primary">Install Extension</Button>
      <Button variant="secondary">Learn more</Button>
      <Button variant="tertiary">Settings</Button>
      <Button variant="install">Install</Button>
      <Button variant="primary" disabled>Disabled</Button>
    </Section>

    <Section title="Verdict badges">
      <VerdictBadge label="Supported"/>
      <VerdictBadge label="Misleading"/>
      <VerdictBadge label="Disputed"/>
      <VerdictBadge label="Unsupported"/>
      <VerdictBadge label="Insufficient evidence"/>
    </Section>

    <Section title="Confidence meter">
      <div style={{width:220}}><ConfidenceMeter confidence={0.25}/></div>
      <div style={{width:220}}><ConfidenceMeter confidence={0.55}/></div>
      <div style={{width:220}}><ConfidenceMeter confidence={0.78}/></div>
    </Section>

    <Section title="Citation cards">
      <div style={{width:320}}><CitationCard evidence={heroEvidence[0]}/></div>
      <div style={{width:320}}><CitationCard evidence={heroEvidence[1]}/></div>
      <div style={{width:320}}><CitationCard evidence={heroEvidence[2]}/></div>
    </Section>

    <Section title="Status chips">
      {statuses.map(state=><StatusChip key={state} state={state}/>)}
    </Section>

    <Section title="Keycaps & tiles">
      <Keycap>⌘ K</Keycap>
      <Keycap>⏎</Keycap>
      <Keycap>Esc</Keycap>
      <AppIconTile label="Verity"><VerityMark size={48}/></AppIconTile>
      <AppIconTile size="lg" label="Verity"><VerityMark size={64}/></AppIconTile>
    </Section>

    <Section title="Pill tabs">
      {["All","Extension","PWA","Web"].map((label,i)=><PillTab key={label} active={pill===i} onClick={()=>setPill(i)}>{label}</PillTab>)}
    </Section>

    <Section title="Text inputs">
      <div style={{width:280}}><TextInput label="Pairing code" placeholder="000000" help="Six digits from your desktop."/></div>
      <div style={{width:280}}><TextInput label="Pairing code" defaultValue="12" error="That pairing code is invalid or expired."/></div>
    </Section>

    <Section title="Command palette">
      <div style={{width:360}}>
        <PaletteCard title="Verity" dots>
          <PaletteRow icon={<VerityMark size={20}/>} label="Check the current claim" keycap={<Keycap>⏎</Keycap>} active/>
          <PaletteRow icon={<VerityMark size={20}/>} label="Start live listening"/>
          <PaletteRow icon={<VerityMark size={20}/>} label="Run disclosed fixture demo" keycap={<Keycap>⌘ D</Keycap>}/>
        </PaletteCard>
      </div>
    </Section>

    <Section title="Glass palette over content (frosted)">
      <div style={{
        position:"relative",width:"100%",maxWidth:760,borderRadius:"var(--rounded-xl)",overflow:"hidden",
        padding:"var(--space-section) var(--space-xl)",display:"flex",justifyContent:"center",
        background:"conic-gradient(from 210deg at 30% 20%, #ffd5c2, #c9e0ff, #d8f5e6, #ffe8b0, #f3d4ff, #ffd5c2)"
      }}>
        <div style={{width:360}}>
          <PaletteCard title="Verity" dots glass>
            <PaletteRow icon={<VerityMark size={20}/>} label="Check the current claim" keycap={<Keycap>⏎</Keycap>} active/>
            <PaletteRow icon={<VerityMark size={20}/>} label="Start live listening"/>
            <PaletteRow icon={<VerityMark size={20}/>} label="Run disclosed fixture demo" keycap={<Keycap>⌘ D</Keycap>}/>
          </PaletteCard>
        </div>
      </div>
    </Section>

    <Section title="Status card">
      <div style={{width:360}}><StatusCard state="CHECKING" body="Verity found missing context — tap to inspect 3 sources."/></div>
      <div style={{width:360}}><StatusCard state="Pair your iPhone" body="Enter the six-digit code shown on your desktop."/></div>
    </Section>

    <Section title="Verdict card">
      <VerdictCard claim={heroClaim}/>
    </Section>

    <Section title="Live overlay replay (heroTimeline)">
      <LiveOverlayDemo/>
    </Section>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Gallery/>);
