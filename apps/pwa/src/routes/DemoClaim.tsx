import { VerdictCard, heroClaim } from "@verity/ui";
import { AppHeader } from "../components/AppHeader";

/** Backend-free demo route for screenshots and judge walk-throughs.
 *  Renders the disclosed hero fixture. Intentionally NOT recorded into history. */
export function DemoClaim() {
  return (
    <div className="vy-app">
      <AppHeader back />
      <main className="vy-page">
        <VerdictCard claim={heroClaim} />
      </main>
    </div>
  );
}
