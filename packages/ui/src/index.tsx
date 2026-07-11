/* @verity/ui — Verity's shared design system (Raycast-derived, see DESIGN.md).
 * Importing the barrel injects the design-system CSS into the current document.
 * For Shadow DOM / MV3 overlays, use `verityCss` + `interFontFaceCss` instead. */
import "./tokens.css";
import "./base.css";
import "./fonts.css";
import "./components/components.css";

export {verityCss,interFontFaceCss} from "./styles";

export {Button} from "./components/Button";
export type {ButtonVariant} from "./components/Button";
export {VerdictBadge} from "./components/VerdictBadge";
export type {VerdictLabel} from "./components/VerdictBadge";
export {ConfidenceMeter,confidenceBand} from "./components/ConfidenceMeter";
export {CitationCard} from "./components/CitationCard";
export {StatusChip} from "./components/StatusChip";
export type {StatusState} from "./components/StatusChip";
export {Keycap} from "./components/Keycap";
export {AppIconTile} from "./components/AppIconTile";
export {PillTab} from "./components/PillTab";
export {TextInput} from "./components/TextInput";
export {PaletteCard,PaletteRow} from "./components/Palette";
export {VerityMark,VerityWordmark} from "./components/VerityMark";
export {StatusCard,VerdictCard} from "./components/cards";

export {heroTimeline,heroClaim,heroEvidence,heroVerdict,replayTimeline} from "./demo";
export type {HeroEnvelope,HeroPayload,TimelineEvent,ReplayOptions} from "./demo";
