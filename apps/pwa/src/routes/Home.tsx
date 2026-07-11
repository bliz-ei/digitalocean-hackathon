import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, TextInput, VerdictBadge, PaletteCard, PaletteRow } from "@verity/ui";
import { AppHeader } from "../components/AppHeader";
import { usePairing, redemptionToken } from "../lib/pairing";
import { usePush } from "../lib/push";
import { readHistory, relativeTime, isSubscribed, type ClaimHistoryEntry } from "../lib/history";

function StepCard({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="vy-status-card vy-step">
      <span className="vy-status-card__eyebrow">Step {n}</span>
      <h2 className="vy-status-card__title">{title}</h2>
      {children}
    </section>
  );
}

function HistoryList({ entries }: { entries: ClaimHistoryEntry[] }) {
  const navigate = useNavigate();
  if (!entries.length) {
    return (
      <section className="vy-status-card">
        <span className="vy-status-card__eyebrow">Recent claims</span>
        <p className="vy-status-card__body vy-mute">Verified claims you open will appear here. Nothing yet — tap a Verity notification to see your first verdict.</p>
      </section>
    );
  }
  return (
    <div className="vy-history">
      <PaletteCard title="Recent claims">
        {entries.map((entry) => (
          <PaletteRow
            key={entry.publicId}
            onClick={() => navigate(`/claims/${encodeURIComponent(entry.publicId)}`)}
            icon={entry.verdict ? <VerdictBadge label={entry.verdict} /> : <span className="vy-verdict-badge vy-verdict-badge--insufficient">Pending</span>}
            label={entry.claimText}
            keycap={<span className="vy-when">{relativeTime(entry.savedAt)}</span>}
          />
        ))}
      </PaletteCard>
    </div>
  );
}

export function Home() {
  const { device, status: pairStatus, code, setCode, pair } = usePairing();
  const { status: pushStatus, enableNotifications, disableNotifications } = usePush(device);
  const [history, setHistory] = useState<ClaimHistoryEntry[]>(() => readHistory());
  const [subscribed, setSubscribed] = useState<boolean>(() => isSubscribed());

  // Auto-redeem when a ?pair= token is present in the URL and we are not yet paired.
  useEffect(() => {
    if (redemptionToken && !device) void pair();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the "you're set" lead-in in sync after enabling/disabling notifications.
  useEffect(() => {
    setSubscribed(isSubscribed());
  }, [pushStatus]);

  // Refresh history on focus (a push may have opened a claim in another tab/window).
  useEffect(() => {
    const refresh = () => setHistory(readHistory());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const allSet = !!device && subscribed;

  return (
    <div className="vy-app">
      <AppHeader />
      <main className="vy-page">
        {allSet ? (
          <section className="vy-status-card">
            <span className="vy-status-card__eyebrow">Verity</span>
            <h1 className="vy-status-card__title">You&rsquo;re set — lock your phone and keep watching</h1>
            <p className="vy-status-card__body">This iPhone is paired and notifications are on. When Verity finishes checking a claim, we&rsquo;ll push the verdict straight to your lock screen.</p>
            {pushStatus && <p className="vy-status-card__body vy-mute" role="status">{pushStatus}</p>}
            <Button variant="secondary" onClick={disableNotifications}>Disable notifications</Button>
          </section>
        ) : (
          <>
            {!device ? (
              <StepCard n={1} title="Pair this iPhone">
                <p className="vy-status-card__body">Open Verity from your Home Screen, then enter the six-digit code shown on your desktop.</p>
                {!redemptionToken && (
                  <TextInput
                    label="Pairing code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  />
                )}
                <Button disabled={!redemptionToken && code.length !== 6} onClick={pair}>
                  {redemptionToken ? "Connect this device" : "Pair device"}
                </Button>
                {pairStatus && <p className="vy-status-card__body vy-mute" role="status">{pairStatus}</p>}
              </StepCard>
            ) : (
              <StepCard n={2} title="Enable notifications">
                <p className="vy-status-card__body">Paired as <strong>{device.device_label}</strong>. Allow notifications so verdicts reach this phone while it&rsquo;s locked.</p>
                <Button onClick={enableNotifications}>Enable notifications</Button>
                <Button variant="secondary" onClick={disableNotifications}>Disable notifications</Button>
                {pushStatus && <p className="vy-status-card__body vy-mute" role="status">{pushStatus}</p>}
              </StepCard>
            )}
          </>
        )}

        <HistoryList entries={history} />
      </main>
    </div>
  );
}
