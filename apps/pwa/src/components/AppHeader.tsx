import { Link } from "react-router-dom";
import { VerityWordmark } from "@verity/ui";

/** Compact app header: VerityWordmark at left, linking home. */
export function AppHeader({ back }: { back?: boolean }) {
  return (
    <header className="vy-appbar">
      <Link to="/" className="vy-appbar__brand" aria-label="Verity home">
        <VerityWordmark size={28} />
      </Link>
      {back && (
        <Link to="/" className="vy-appbar__back">
          Home
        </Link>
      )}
    </header>
  );
}
