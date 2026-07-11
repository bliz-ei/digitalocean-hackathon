import {Nav} from "./sections/Nav";
import {Hero} from "./sections/Hero";
import {HowItWorks} from "./sections/HowItWorks";
import {Verdicts} from "./sections/Verdicts";
import {Trust} from "./sections/Trust";
import {IPhone} from "./sections/IPhone";
import {CtaBand} from "./sections/CtaBand";
import {Footer} from "./sections/Footer";

/** Verity marketing site — a single landing page. The whole tree lives inside
 *  `.vy-root` so the design-system reset, Inter/ss03 rendering, and dark canvas
 *  defaults from @verity/ui apply (mirrors how apps/pwa mounts). */
export function App(){
  return (
    <div className="vy-root web-root">
      <Nav/>
      <main>
        <Hero/>
        <HowItWorks/>
        <Verdicts/>
        <Trust/>
        <IPhone/>
        <CtaBand/>
      </main>
      <Footer/>
    </div>
  );
}
