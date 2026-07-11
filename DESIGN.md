# DESIGN.md — Verity Glass (v2, light mode)

> **v2 pivot (2026-07-11):** the system keeps Raycast's structural vocabulary — command-palette cards, hairline edges, keycaps, the 4–16px radius scale, Inter with ss03, tight in-card padding, 96px section rhythm — but flips to a **light, premium, frosted-glass aesthetic** modeled on aside.com's landing page and the macOS Raycast app's translucent panels. Dark mode is gone. Token *names* are unchanged from v1 so component CSS keys stay stable; their *values* are remapped below (e.g. `on-dark` now reads "primary interactive text on light chrome").

## Overview

Verity's chrome is a light, airy canvas with floating frosted-glass panels. The product surface (command palette / overlay) is a translucent white panel with backdrop blur — a macOS-vibrancy feel — floating over content or over a soft ambient red-coral wash. The marketing page is structured like aside.com: centered display headline over an atmospheric gradient hero band, a full-fidelity product mockup as the hero visual, alternating white / off-white sections, pastel gradient illustration cards, one dark pill CTA, and a soft wash reprise in the closing CTA band.

**Key characteristics:**
- Light surface ladder: `{colors.canvas}` (#fbfbfc page) → `{colors.surface}` (#ffffff card) → `{colors.surface-elevated}` (#f4f5f7 input/tertiary fill) → `{colors.surface-card}` (#eef0f2 icon tile / row hover)
- **Glass tier** for floating product surfaces (overlay, palette mockups, sticky nav): translucent white + backdrop blur + inner light border + soft diffuse shadow
- Single **dark pill CTA** (`{colors.primary}` #0b0c0e, white text) — the light-mode inversion of Raycast's white pill; still at most one per fold
- Hairline 1px borders carry flat card edges; **soft diffuse shadows are now allowed but only on floating/glass panels** — flat in-page cards stay shadowless
- Inter with `font-feature-settings: "calt", "kern", "liga", "ss03"` site-wide (unchanged)
- Saturated accents confined to verdict badge chips and illustration washes — never chrome
- The red brand moment survives as a **soft ambient red-coral glow/wash** (hero band + closing CTA band echoes), replacing v1's dark stripe band — still max once per page as the dominant hero moment

## Verity-specific decisions (binding)

1. **Verdict color mapping — soft accent badges** (unchanged concept, light-tuned): tinted chip backgrounds with **deepened accent text** for AA contrast on light:
   - Supported → bg `{colors.accent-green-soft}` / text `{colors.accent-green}` (#0e8a4f)
   - Misleading → bg `{colors.accent-yellow-soft}` / text `{colors.accent-yellow}` (#9a6200)
   - Disputed → bg `{colors.accent-blue-soft}` / text `{colors.accent-blue}` (#0b6fb4)
   - Unsupported → bg `{colors.accent-red-soft}` / text `{colors.accent-red}` (#c93838)
   - Insufficient evidence → bg `{colors.surface-elevated}` / text `{colors.mute}`
2. **Confidence display:** qualitative band (<0.4 Low / 0.4–0.7 Moderate / >0.7 High) + thin monochrome segment meter (ink-alpha fills, no accent) + exact % in mute caption. Unchanged.
3. **Brand mark:** checkmark/citation glyph in a rounded tile. On light chrome the tile stays **deep ink** (#0b0c0e with white glyph) so the mark anchors like a macOS app icon; hairline border, 8px radius. Same asset works as favicon/extension/PWA icon.
4. **Overlay = frosted glass palette:** floating bottom-right command-palette card ~360px, Shadow DOM, `{glass}` treatment (translucent white + blur) so YouTube subtly shows through; collapsible to a glass pill. Pure display layer; five states: Listening, Transcribing, Checking, Completed, Could not verify.
5. **Trust rule as layout law:** source evidence visually distinct from model interpretation on every verdict surface (zones separated by surface/labels).
6. **Verbatim demo copy:** "Verity is checking…", "Verity found missing context — tap to inspect 3 sources.", "Verity follows the claim—not the platform." Never paraphrase.
7. **Landing page = aside.com structure:** centered hero headline on ambient wash → glass product mockup (live replay) → alternating white/canvas sections with centered section headlines → pastel gradient feature cards → dark-pill CTA band on a soft wash → light footer.

## Colors

Token names are v1's; values are the v2 light remap.

### Brand & Action
- **Primary** (`{colors.primary}` — `#0b0c0e`): the dark pill CTA background. "Add to Chrome" / "Install" / "Get started" — every primary action.
- **Primary Pressed** (`{colors.primary-pressed}` — `#26282b`): pressed state, one notch lighter.
- **On Primary** (`{colors.on-primary}` — `#ffffff`): white text/icon on the dark pill.

### Surface
- **Canvas** (`{colors.canvas}` — `#fbfbfc`): page background. Sections may alternate canvas and pure white.
- **Surface** (`{colors.surface}` — `#ffffff`): card and panel background.
- **Surface Elevated** (`{colors.surface-elevated}` — `#f4f5f7`): tertiary-button fill, text-input fill, active pill-tab fill, keycap base.
- **Surface Card** (`{colors.surface-card}` — `#eef0f2`): icon-tile background, palette row hover/selection.
- **Button FG (in-card)** (`{colors.button-fg}` — `#e9ebee`): deep in-card variant (featured tier fills).
- **Hairline** (`{colors.hairline}` — `rgba(9,10,12,0.08)`): universal 1px flat-card border.
- **Hairline Soft** (`{colors.hairline-soft}` — `rgba(9,10,12,0.05)`): faint divider.
- **Hairline Strong** (`{colors.hairline-strong}` — `rgba(9,10,12,0.16)`): focused-input border, strong divider.

### Glass (new tier — floating surfaces only)
- **Glass BG** (`{colors.glass-bg}` — `rgba(255,255,255,0.66)`): overlay/palette/nav panel fill over arbitrary content.
- **Glass BG Strong** (`{colors.glass-bg-strong}` — `rgba(255,255,255,0.82)`): denser variant when legibility needs it (over video).
- **Glass Border** (`{colors.glass-border}` — `rgba(255,255,255,0.55)`): 1px inner light border (top-edge highlight feel), paired with an outer `{colors.hairline}`.
- **Glass blur:** `backdrop-filter: blur(24px) saturate(180%)`. Fallback when unsupported: `{colors.glass-bg-strong}` opaque-ish fill.
- **Shadow Float** (`{shadow.float}` — `0 12px 40px rgba(9,10,12,0.10)`) and **Shadow Soft** (`{shadow.soft}` — `0 2px 12px rgba(9,10,12,0.06)`): allowed ONLY on glass/floating panels and the sticky nav. Flat in-page cards remain shadowless with hairline edges.

### Text
- **Ink** (`{colors.ink}` — `#0b0c0e`): headlines.
- **Body** (`{colors.body}` — `#3f4247`): default paragraphs.
- **Charcoal** (`{colors.charcoal}` — `#26282b`): brighter body emphasis.
- **Mute** (`{colors.mute}` — `#6f7377`): metadata, captions, footer links.
- **Ash** (`{colors.ash}` — `#9a9da1`): disabled text.
- **Stone** (`{colors.stone}` — `#c3c6c9`): lowest-emphasis caption/disabled icon.
- **On Dark** (`{colors.on-dark}` — `#0b0c0e`): *renamed in meaning*: primary interactive text on light chrome (button labels, active tabs, link-inline).
- **On Dark Mute** (`{colors.on-dark-mute}` — `rgba(11,12,14,0.66)`): secondary interactive text.

### Semantic accents (badge chips + illustrations only — never chrome)
- **Accent Green** `#0e8a4f` + **Soft** `rgba(89,212,153,0.18)` — success; Supported.
- **Accent Yellow** `#9a6200` + **Soft** `rgba(255,197,51,0.22)` — warning; Misleading.
- **Accent Red** `#c93838` + **Soft** `rgba(255,97,97,0.16)` — error; Unsupported.
- **Accent Blue** `#0b6fb4` + **Soft** `rgba(87,193,255,0.18)` — info; Disputed.

### Ambient washes (new — replaces the dark stripe band)
- **Hero Wash**: soft red-coral atmospheric gradient — layered radial gradients of `{colors.hero-stripe-start}` (`#ff5757`) and `{colors.hero-stripe-end}` (`#a1131a`) at 8–18% alpha over white, blurred/diffuse (aside-style atmosphere, Raycast-red hue). Dominant use once per page in the hero band; a fainter echo is allowed in the closing CTA band and behind the overlay mockup.
- **Pastel illustration washes**: soft multi-stop pastel gradients inside feature-card illustrations (aside-style), derived from the accent hues at low saturation.
- **Keycap Gradient** (`{colors.key-bg-start}` `#f7f8fa` → `{colors.key-bg-end}` `#eceef1`): the physical-key feel, light version.

## Typography

Unchanged from v1: **Inter** with `font-feature-settings: "calt", "kern", "liga", "ss03"` site-wide; display tier adds `ss02`/`ss08` with `liga 0`. Same size/weight/line-height/tracking table:

| Token | Size | Weight | LH | LS | Use |
|---|---|---|---|---|---|
| display-xl | 64px | 600 | 1.1 | 0 | Hero headline (centered on landing, per aside) |
| display-lg | 56px | 500 | 1.17 | 0.2px | Section headline |
| heading-xl | 24px | 500 | 1.6 | 0.2px | Sub-section heading |
| heading-lg | 22px | 500 | 1.15 | 0 | Feature heading |
| heading-md | 20px | 500 | 1.4 | 0.2px | Card group title |
| heading-sm | 18px | 500 | 1.4 | 0.2px | Card title |
| body-lg | 18px | 400 | 1.6 | 0 | Hero subtitle |
| body-md | 16px | 400 | 1.6 | 0 | Default body |
| body-strong | 16px | 500 | 1.4 | 0.2px | Emphasis, nav link |
| body-sm | 14px | 400 | 1.6 | 0 | Card description |
| body-sm-strong | 14px | 500 | 1.6 | 0.2px | In-card label |
| caption-md | 13px | 400 | 1.4 | 0.1px | Caption, metadata |
| caption-sm | 12px | 400 | 1.5 | 0.4px | Badge label |
| link-md | 16px | 500 | 1.4 | 0.3px | Inline link |
| button-md | 14px | 500 | 1.6 | 0.2px | Button label |

Landing-page display text is **center-aligned** in hero and section-intro bands (aside pattern); in-app text stays left-aligned.

## Layout

Unchanged metrics: 8px base unit; spacing tokens xxs 2 / xs 4 / sm 8 / md 12 / lg 16 / xl 24 / xxl 32 / section 96. Content max-width ~1240px, 24px gutters. In-card padding 16–24px. Grids and breakpoints as v1.

**Aside-specific layout patterns for the landing page:** centered narrow hero copy column (~720px); product mockup full-width beneath the headline inside the hero band; sections alternate `{colors.canvas}` and `#ffffff` backgrounds (the only sanctioned "divider"); 3-up pastel illustration card rows; centered section headlines with small accent-colored eyebrow links (`{typography.caption-sm}`, accent-blue or red, "Introducing Verity →" style — the one sanctioned use of accent on text, matching aside's eyebrow pattern).

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 — Flat | No border/shadow | Canvas blocks, hero text, footer |
| 1 — Hairline | 1px `{colors.hairline}` | Flat in-page cards (feature, citation, pricing) |
| 2 — Hairline strong | 1px `{colors.hairline-strong}` | Focused inputs, strong dividers |
| 3 — Surface ladder | canvas → surface → elevated → card | In-card nesting without shadows |
| 4 — **Glass float** | `{colors.glass-bg}` + blur(24px) saturate(180%) + inner `{colors.glass-border}` + outer hairline + `{shadow.float}` | Overlay palette, hero mockup panel, sticky nav, collapsed pill |

Shadows exist ONLY at level 4. If a surface doesn't float over other content, it doesn't get a shadow.

## Shapes

Unchanged: xs 4 / sm 6 / md 8 / lg 10 / xl 16 / full pill. Glass panels use `{rounded.xl}` (16px); the collapsed overlay pill uses `{rounded.full}`.

## Components

Metrics unchanged from v1; colors remapped via tokens. Deltas:

- **`button-primary`** — dark pill: bg `{colors.primary}`, text `{colors.on-primary}`, 36px, `{rounded.md}` (or `{rounded.full}` on marketing hero CTAs, aside-style).
- **`button-secondary`** — transparent, text ink.
- **`button-tertiary`** — bg `{colors.surface-elevated}`, text ink.
- **`install-button`** — 1px `{colors.hairline-strong}` border, transparent.
- **`text-input` / `store-search-bar`** — bg white or `{colors.surface-elevated}`, hairline border, focus = hairline-strong.
- **`command-palette-card`** — **glass**: `{colors.glass-bg}` + blur + glass-border inner + hairline outer + `{shadow.float}`, `{rounded.lg}`/`{rounded.xl}`. Header strip, palette rows, keycap hints as before. When it sits inside a flat page section (not floating over content), the opaque `{colors.surface}` variant with plain hairline is also allowed.
- **`command-palette-row`** — transparent → hover/active `{colors.surface-card}` (or `rgba(9,10,12,0.05)` on glass).
- **`feature-card-dark`** → now **`feature-card`**: bg `{colors.surface}`, hairline, 24px pad, `{rounded.lg}`; `-elevated` variant uses `{colors.surface-elevated}`.
- **`keycap`** — light gradient key-bg, ink-mute glyph.
- **`primary-nav`** — **glass sticky**: `{colors.glass-bg}` + blur + bottom hairline, ~56px; wordmark left, center links, dark CTA pill right. Mobile: hamburger + drawer (glass-bg-strong).
- **`footer-section`** — bg `{colors.canvas}`, top hairline, light link grid; optional faint hero-wash echo at the very bottom edge.
- **`hero-wash-band`** (replaces `hero-stripe-band`) — white/canvas base with the diffuse red-coral ambient wash behind centered display-xl copy and the glass product mockup. Once per page.
- **VerdictBadge, ConfidenceMeter, CitationCard, StatusChip, AppIconTile, PillTab, StatusCard, VerdictCard** — same anatomy, light tokens; citation excerpts sit on `{colors.surface-elevated}` quote blocks; evidence vs interpretation zones separated by surface + labeled captions.

## Do's and Don'ts

### Do
- Render everything in one continuous light mode; alternate white and canvas section backgrounds for rhythm.
- Use the dark pill for every primary CTA; at most one per fold.
- Use glass (blur + translucency + float shadow) for anything that floats over other content: overlay, sticky nav, hero mockup panel, collapsed pill.
- Keep flat cards hairline-edged and shadowless.
- Enable ss03 Inter everywhere.
- Keep the red-coral ambient wash as the hero's single atmospheric moment; faint echo allowed in the closing CTA band.
- Keep saturated accents inside verdict chips, eyebrow micro-links, and illustration washes only.
- Respect `prefers-reduced-motion` (freeze replays) and `backdrop-filter` fallbacks.

### Don't
- Don't reintroduce dark mode or near-black canvases (the dark ink pill and brand tile are the only deep-ink surfaces).
- Don't put shadows on flat in-page cards.
- Don't tint the primary CTA with accent color.
- Don't use accent color on body text, buttons, or chrome beyond eyebrow links and badge chips.
- Don't stack multiple washes in one viewport; atmosphere is scarce.
- Don't use Inter without ss03.
- Don't let glass panels drop below ~0.6 effective white opacity over busy video without switching to `{colors.glass-bg-strong}`.

## Responsive Behavior

Unchanged from v1: breakpoints (1920/1440/1280/1024/768/480/320), touch targets ≥36px, nav → hamburger at 768, grids collapse 3→2+1→1, section padding 96→64→48, hero type 64→56→44→36, comparison tables → horizontal scroll → stacked cards. Hero mockup: 2-col → stacked → ~92% width at mobile. Glass blur radius may drop to 16px at mobile for performance.

## Iteration Guide

1. One component at a time; every property resolves to a token.
2. Reference tokens by name; values live in tokens.css only.
3. Glass is a privilege of floating surfaces — ask "does this float over other content?" before applying it.
4. At most one dark pill per fold; at most one wash per viewport.
5. Verify AA contrast for accent text on tinted chips (the deepened accent values exist for this).
