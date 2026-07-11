import {useState} from "react";
import {Nav} from "./sections/Nav";
import {Hero} from "./sections/Hero";
import {Intro} from "./sections/Intro";
import {Capability} from "./sections/Capability";
import {Verdicts} from "./sections/Verdicts";
import {IPhone} from "./sections/IPhone";
import {Byok} from "./sections/Byok";
import {Trust} from "./sections/Trust";
import {CtaBand} from "./sections/CtaBand";
import {Footer} from "./sections/Footer";
import {InstallModal} from "./sections/InstallModal";

/** Verity marketing site — a single landing page mirroring aside.com's structure and
 *  motion with Verity's own content. The whole tree lives inside `.vy-root` so the
 *  design-system reset, Inter/ss03 rendering, and light canvas defaults from @verity/ui
 *  apply (mirrors how apps/pwa mounts). The load-unpacked install modal is owned here so
 *  every "Add to Chrome" pill — nav, hero, closing band — opens the same guide. */
export function App(){
  const [installOpen,setInstallOpen]=useState(false);
  const openInstall=()=>setInstallOpen(true);

  return (
    <div className="vy-root web-root">
      <Nav onInstall={openInstall}/>
      <main>
        <Hero onInstall={openInstall}/>
        <Intro/>
        <Capability/>
        <Verdicts/>
        <IPhone/>
        <Byok/>
        <Trust/>
        <CtaBand onInstall={openInstall}/>
      </main>
      <Footer/>
      <InstallModal open={installOpen} onClose={()=>setInstallOpen(false)}/>
    </div>
  );
}
