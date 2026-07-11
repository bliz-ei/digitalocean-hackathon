import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type Claim } from "@verity/contracts";
import { VerdictCard, Button } from "@verity/ui";
import { AppHeader } from "../components/AppHeader";
import { base } from "../lib/config";
import { recordClaim } from "../lib/history";

function Skeleton() {
  return (
    <div className="vy-skel" aria-hidden="true">
      <div className="vy-skel__line vy-skel__line--eyebrow" />
      <div className="vy-skel__line vy-skel__line--badge" />
      <div className="vy-skel__block vy-skel__block--claim" />
      <div className="vy-skel__line vy-skel__line--caption" />
      <div className="vy-skel__block vy-skel__block--zone" />
      <div className="vy-skel__block vy-skel__block--zone" />
    </div>
  );
}

export function ClaimPage() {
  const { publicId = "" } = useParams();
  // A verdict tapped from a push notification may not be committed yet, so poll the
  // canonical claim up to 8 times (1.5s apart) before giving up. Offline stops early.
  const query = useQuery<Claim>({
    queryKey: ["claim", publicId],
    queryFn: () => api.getClaim(base, publicId),
    enabled: !!publicId,
    retry: (failureCount) => navigator.onLine && failureCount < 8,
    retryDelay: 1500,
  });

  // On a successful load, record the claim into this device's local history.
  useEffect(() => {
    if (query.data) recordClaim(query.data);
  }, [query.data]);

  return (
    <div className="vy-app">
      <AppHeader back />
      <main className="vy-page">
        {query.isLoading && (
          <section className="vy-status-card" role="status" aria-busy="true">
            <span className="vy-status-card__eyebrow">Verity</span>
            <span className="vy-status-card__title">
              {query.failureCount > 0 ? `Loading verdict… (${query.failureCount}/8)` : "Loading verdict…"}
            </span>
            <Skeleton />
          </section>
        )}

        {query.isError && (
          <section className="vy-status-card" role="alert">
            <span className="vy-status-card__eyebrow">Verity</span>
            <span className="vy-status-card__title">
              {navigator.onLine ? "Result not found" : "Offline — reconnect to load this result"}
            </span>
            <p className="vy-status-card__body vy-mute">
              {navigator.onLine
                ? "We couldn't find this claim. It may have expired or the link is incorrect."
                : "This device is offline. Reconnect and try again to load the evidence."}
            </p>
            <Button variant="tertiary" onClick={() => query.refetch()}>Try again</Button>
          </section>
        )}

        {query.data && (
          <VerdictCard claim={query.data} />
        )}
      </main>
    </div>
  );
}
