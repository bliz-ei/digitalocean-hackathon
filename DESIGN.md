# DESIGN.md — Verity Frontend Design System (Raycast-derived)

## Overview

Raycast's marketing site reads like an extended product screenshot. The chrome IS the in-product command palette at marketing scale: pure near-black canvas (`{colors.canvas}` — `#07080a`), hairline 1px borders (`{colors.hairline}` — `#242728`), command-palette-style cards with rounded corners between 6 and 16px, Inter typography with the **ss03 stylistic set enabled site-wide** (a single character — the alternate `g` — that gives Raycast's typography its signature subtle distinction), a single white CTA pill that anchors every primary action, and small splashes of saturated accent reserved for category illustrations.

The system has effectively one surface mode — dark — with a faint three-step surface ladder (`{colors.canvas}` → `{colors.surface}` → `{colors.surface-elevated}` → `{colors.surface-card}`) carrying cards, in-card panels, and key-cap glyph backgrounds. The signature decorative moment is a **red diagonal-stripe gradient band** across the very top of the home page hero, used as a launch-banner motif behind the headline (the only time saturated red appears on chrome). Beyond that single moment, color in the chrome is reserved for category accents inside extension and feature illustrations: Hacker News yellow, Slack red, Linear green, info blue.

The design philosophy is "the marketing page is the product." Section rhythm is generous (`{spacing.section}` 96px) but the page never breaks tonal continuity — the whole site sits in one continuous dark mode, full-bleed product UI screenshots show the actual command palette / store / AI chat surfaces, and the typography ligature settings (`ss03`) are inherited from the in-product app's text rendering.

**Key Characteristics:**
- Single dark surface mode with a 4-step surface ladder: `{colors.canvas}` (#07080a) → `{colors.surface}` (#0d0d0d) → `{colors.surface-elevated}` (#101111) → `{colors.surface-card}` (#121212)
- White CTA pill (`{colors.primary}` — #ffffff) is the universal primary action; everything else is monochrome dark
- Inter typography with `font-feature-settings: "calt", "kern", "liga", "ss03"` enabled site-wide — the ss03 alternate `g` is part of the brand voice
- Hairline 1px borders (`{colors.hairline}` — #242728) carry every card edge; there are no drop shadows in the system
- Multi-radius card vocabulary: `{rounded.sm}` (6px) for keycaps, `{rounded.md}` (8px) for buttons and small cards, `{rounded.lg}` (10px) for feature cards, `{rounded.xl}` (16px) for hero command-palette mockup containers
- Saturated category accents (`{colors.accent-yellow}`, `{colors.accent-red}`, `{colors.accent-green}`, `{colors.accent-blue}`) appear only inside extension tile imagery — never on chrome
- Signature red diagonal-stripe gradient band at the very top of the hero — three angled stripes in `{colors.hero-stripe-start}` → `{colors.hero-stripe-end}`, used once per page maximum

## Verity-specific decisions (locked in grill session, 2026-07-11)

These extend the Raycast system for Verity's product needs. They are binding.

1. **Verdict color mapping — soft accent badges.** Extend the `badge-info-soft` pattern:
   - Supported → `{colors.accent-green-soft}` bg / `{colors.accent-green}` text
   - Misleading → `{colors.accent-yellow-soft}` bg / `{colors.accent-yellow}` text
   - Unsupported → `{colors.accent-red-soft}` bg / `{colors.accent-red}` text
   - Disputed → `{colors.accent-blue-soft}` bg / `{colors.accent-blue}` text (sources conflict = informational)
   - Insufficient evidence → `{colors.surface-elevated}` bg / `{colors.mute}` text
   Accents stay confined to badge chips. Body, buttons, chrome remain monochrome.
2. **Confidence display — qualitative + subtle meter.** Bands: <0.4 Low / 0.4–0.7 Moderate / >0.7 High. Render "High confidence" text + thin monochrome segment meter (surface-ladder fill, no accent). Exact % in a smaller `{colors.mute}` caption.
3. **Brand mark — glyph tile + wordmark.** Minimal SVG checkmark/citation glyph inside a rounded app-icon tile (`{colors.surface-card}` bg, hairline border, `{rounded.md}` 8px) beside "Verity" in Inter 600 with ss03. The tile doubles as extension icon, PWA icon, favicon.
4. **Overlay** (extension content script): floating command-palette card, bottom-right, ~360px wide, Shadow DOM, collapsible to a status pill. Header = status chip + collapse control; body = live transcript rows with speaker labels; claims expand into verdict cards. Pure display layer switching on WebSocket event `type`.
5. **Trust rule as layout law:** source evidence (excerpts, citation cards) must be *visually distinct* from model interpretation (explanation, uncertainty, common ground). Use surface ladder + section labels to separate the two zones on every verdict surface.
6. **Verbatim demo copy is load-bearing:** "Verity is checking…", "Verity found missing context — tap to inspect 3 sources.", "Verity follows the claim—not the platform." Do not paraphrase these strings.
7. **Overlay states (exact names):** Listening, Transcribing, Checking, Completed, Could not verify.

## Colors

### Brand & Accent
- **White** (`{colors.primary}` — `#ffffff`): the universal primary CTA pill background. "Download" / "Install Extension" / "Get Pro" — every primary action carries it.
- **White Pressed** (`{colors.primary-pressed}` — `#e8e8e8`): pressed-state for the primary pill — a single notch dimmer.
- **On Primary** (`{colors.on-primary}` — `#000000`): pure black text on the white CTA — the only place black appears as text in the system.

### Surface
- **Canvas** (`{colors.canvas}` — `#07080a`): pure-near-black page background. The dominant surface across every page.
- **Surface** (`{colors.surface}` — `#0d0d0d`): card and elevated panel background — one notch lighter than canvas.
- **Surface Elevated** (`{colors.surface-elevated}` — `#101111`): button-tertiary fill, text-input fill, store-search-bar fill, pill-tab-active fill.
- **Surface Card** (`{colors.surface-card}` — `#121212`): app-icon-tile background, keycap fill, command-palette row hover.
- **Button FG (in-card)** (`{colors.button-fg}` — `#18191a`): rare deep-card variant used inside featured pricing tier card backgrounds.
- **Hairline** (`{colors.hairline}` — `#242728`): the universal 1px card border. Carries every card edge across every page.
- **Hairline Soft** (`{colors.hairline-soft}` — `rgba(255,255,255,0.08)`): even fainter border on translucent over-image overlays.
- **Hairline Strong** (`{colors.hairline-strong}` — `rgba(255,255,255,0.16)`): stronger 1px divider where a regular hairline reads as too soft.

### Text
- **Ink** (`{colors.ink}` — `#f4f4f6`): primary headlines on dark canvas.
- **Body** (`{colors.body}` — `#cdcdcd`): default paragraph text and inline-link color.
- **Charcoal** (`{colors.charcoal}` — `#d3d3d4`): subtly brighter body where ink reads too soft.
- **Mute** (`{colors.mute}` — `#9c9c9d`): metadata, footer link text, secondary captions.
- **Ash** (`{colors.ash}` — `#6a6b6c`): disabled-state text, lowest-emphasis utility.
- **Stone** (`{colors.stone}` — `#434345`): least-emphasis caption text and disabled icon color.
- **On Dark** (`{colors.on-dark}` — `#ffffff`): interactive-state primary text (button label, focused tab).
- **On Dark Mute** (`{colors.on-dark-mute}` — `rgba(255,255,255,0.72)`): translucent secondary text on dark surfaces.

### Semantic
- **Accent Blue** (`{colors.accent-blue}` — `#57c1ff`) + **Soft** (`{colors.accent-blue-soft}` — `rgba(87,193,255,0.15)`): info badge; Verity: Disputed verdict.
- **Accent Red** (`{colors.accent-red}` — `#ff6161`) + **Soft** (`{colors.accent-red-soft}` — `rgba(255,97,97,0.15)`): destructive/error; Verity: Unsupported verdict.
- **Accent Green** (`{colors.accent-green}` — `#59d499`) + **Soft** (`{colors.accent-green-soft}` — `rgba(89,212,153,0.15)`): success; Verity: Supported verdict.
- **Accent Yellow** (`{colors.accent-yellow}` — `#ffc533`) + **Soft** (`{colors.accent-yellow-soft}` — `rgba(255,197,51,0.15)`): warning; Verity: Misleading verdict.

### Brand Gradient
- **Hero Stripe Gradient** — three diagonal red stripes layered across the very top of the home page hero, fading from `{colors.hero-stripe-start}` (`#ff5757`) to `{colors.hero-stripe-end}` (`#a1131a`). The system's only chromatic gradient on chrome — used once per page maximum and reserved for hero launch-banner moments.
- **Keycap Gradient** — key-glyph background uses a subtle linear-gradient from `{colors.key-bg-start}` (`#121212`) to `{colors.key-bg-end}` (`#0d0d0d`).

## Typography

### Font Family
**Inter**, loaded with `Inter Fallback` → `system-ui` fallback. Enable `font-feature-settings: "calt", "kern", "liga", "ss03"` site-wide — the **ss03 stylistic set** (alternate single-story `g`) is the brand's signature typographic detail. The display tier additionally enables `ss02` and `ss08` and disables standard `liga`. No monospace outside inline `<code>` chips (JetBrains Mono or Geist Mono acceptable there).

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 64px | 600 | 1.1 | 0 | Hero headline (with `liga: 0`, `ss02`, `ss08`) |
| `{typography.display-lg}` | 56px | 500 | 1.17 | 0.2px | Section headline |
| `{typography.heading-xl}` | 24px | 500 | 1.6 | 0.2px | Sub-section heading, pricing-tier name |
| `{typography.heading-lg}` | 22px | 500 | 1.15 | 0 | Mid-section feature heading |
| `{typography.heading-md}` | 20px | 500 | 1.4 | 0.2px | Card group title, in-card heading |
| `{typography.heading-sm}` | 18px | 500 | 1.4 | 0.2px | Small heading, extension card title |
| `{typography.body-lg}` | 18px | 400 | 1.6 | 0 | Tier description, hero subtitle |
| `{typography.body-md}` | 16px | 400 | 1.6 | 0 | Default body, paragraph text |
| `{typography.body-strong}` | 16px | 500 | 1.4 | 0.2px | Inline emphasis, primary nav link |
| `{typography.body-sm}` | 14px | 400 | 1.6 | 0 | Card description, secondary copy |
| `{typography.body-sm-strong}` | 14px | 500 | 1.6 | 0.2px | In-card label, table-header text |
| `{typography.caption-md}` | 13px | 400 | 1.4 | 0.1px | Caption, metadata |
| `{typography.caption-sm}` | 12px | 400 | 1.5 | 0.4px | Smallest utility text, badge label |
| `{typography.link-md}` | 16px | 500 | 1.4 | 0.3px | Inline body anchor link |
| `{typography.button-md}` | 14px | 500 | 1.6 | 0.2px | Standard button label |

### Principles
1.6 line-height ladder for body; 1.1–1.4 for display/heading. Letter-spacing consistently positive (0.1–0.4px). Without `ss03` the body face renders as plain Inter and loses the signature rendering.

## Layout

### Spacing System
- **Base unit:** 8px (with 2/4/12px steps for tight inline gaps).
- **Tokens:** `{spacing.xxs}` (2px) · `{spacing.xs}` (4px) · `{spacing.sm}` (8px) · `{spacing.md}` (12px) · `{spacing.lg}` (16px) · `{spacing.xl}` (24px) · `{spacing.xxl}` (32px) · `{spacing.section}` (96px).
- **Universal section rhythm:** 96px between major blocks. Card grids use 16px gutters; in-card padding 24px for feature cards, 16px for store extension cards.

### Grid & Container
- **Max width:** ~1240px content area at desktop with 24px gutters (~48px at ultrawide). Hero mockups run wider (~1080px) with full-bleed background.
- **Store extension grid:** 2-up desktop → 1-up mobile. Horizontal card: large square app icon left, copy + Install button right.
- **Pricing tier grid:** 3-up desktop → 1-up mobile.
- **Footer:** 6-column link grid desktop → 2-up tablet → 1-up mobile.

### Whitespace Philosophy
Sections sit 96px apart with no decorative dividers — the dark canvas continues edge-to-edge. Content left-aligned in a tight column, mockup imagery occupying the right 50–60% of feature rows. The red stripe band appears only in the first hero band.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 — Flat | No border, no shadow | Canvas-on-canvas blocks, hero text, footer body |
| 1 — Hairline border | 1px solid `{colors.hairline}` | Every card on `{colors.surface}` |
| 2 — Hairline strong | 1px solid `{colors.hairline-strong}` | Stronger divider, table-row separator |
| 3 — Surface ladder | canvas → surface → surface-elevated → surface-card | Elevation without shadows |

**No drop shadows anywhere.** Depth is the surface-color ladder only.

### Decorative Depth
- **Hero stripe gradient** — once, home hero only.
- **Command-palette mockups** — the product UI is the brand decoration.
- **App icon tiles** — 48–64px rounded tiles.
- **Keycap glyphs** — gradient-filled rounded keycaps for shortcuts (`⌘ K`, `⏎`, `Esc`).

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Hero band, nav, footer |
| `{rounded.xs}` | 4px | Keycaps, badge chips, inline tags |
| `{rounded.sm}` | 6px | Command-palette row, micro chips |
| `{rounded.md}` | 8px | Buttons, inputs, search bar, app-icon tiles, store cards |
| `{rounded.lg}` | 10px | Feature card, palette mockup card, pricing card |
| `{rounded.xl}` | 16px | Large hero mockup container |
| `{rounded.full}` | 9999px | Pill-tab chips, avatars |

## Components

> No hover states documented. Default and Active/Pressed only.

### Buttons
- **`button-primary`**: bg `{colors.primary}`, text `{colors.on-primary}`, `{typography.button-md}`, padding `8px 16px`, ~36px height, `{rounded.md}`. Pressed → `{colors.primary-pressed}`.
- **`button-secondary`**: transparent bg, text `{colors.on-dark}`, same metrics.
- **`button-tertiary`**: bg `{colors.surface-elevated}`, text `{colors.on-dark}`, same metrics.
- **`button-disabled`**: bg `{colors.surface-elevated}`, text `{colors.ash}`.
- **`install-button`**: transparent bg, 1px `{colors.hairline-strong}` border, text `{colors.on-dark}`, padding `6px 14px`, `{rounded.md}`.

### Filter & Tab Chips
- **`pill-tab`** / **`pill-tab-active`**: transparent → `{colors.surface-elevated}` bg, text `{colors.body}` → `{colors.on-dark}`, `{typography.body-sm}`, padding `4px 10px`, `{rounded.full}`.
- **`badge-pro`**: bg `{colors.surface-elevated}`, text `{colors.on-dark-mute}`, `{typography.caption-sm}`, padding `2px 6px`, `{rounded.xs}`.
- **`badge-info-soft`**: bg `{colors.accent-blue-soft}`, text `{colors.accent-blue}`, `{typography.caption-sm}`, padding `2px 8px`, `{rounded.xs}`. (Verity verdict badges follow this pattern per verdict mapping above.)

### Inputs & Forms
- **`text-input`**: bg `{colors.surface-elevated}`, text `{colors.on-dark}`, 1px `{colors.hairline}`, `{typography.body-md}`, padding `8px 12px`, ~36px, `{rounded.md}`. Focused → border `{colors.hairline-strong}` (brightening, not a colored ring).
- **`store-search-bar`**: same family, padding `10px 16px`, ~44px tall, magnifier icon left.

### Cards & Containers
- **`command-palette-card`**: bg `{colors.surface}`, 1px `{colors.hairline}`, padding 0, `{rounded.lg}`/`{rounded.xl}`. Header strip with traffic-light dots + search row; body = stack of command-palette rows; bottom-right keycap hints.
- **`command-palette-row`** / **`-active`**: transparent → `{colors.surface-card}` bg, text `{colors.on-dark}` `{typography.body-md}`, padding `6px 10px`, `{rounded.sm}`. App-icon tile + label + optional keycap at right.
- **`feature-card-dark`**: bg `{colors.surface}`, 1px `{colors.hairline}`, padding 24px, `{rounded.lg}`.
- **`feature-card-elevated`**: same, bg `{colors.surface-elevated}`.
- **`store-extension-card`**: bg `{colors.surface}`, 1px `{colors.hairline}`, padding 16px, `{rounded.md}`. 48px icon left, name/author/description center, install button right.
- **`pricing-tier-card`** / **`-featured`**: bg `{colors.surface}` / `{colors.surface-elevated}`, 1px `{colors.hairline}`, padding 24px, `{rounded.lg}`.
- **`hero-stripe-band`**: bg `{colors.canvas}` with three diagonal red stripes across top half, padding 96px vertical / 48px horizontal, `{rounded.none}`.

### Decorative
- **`app-icon-tile`**: bg `{colors.surface-card}`, `{rounded.md}`, 48×48. **`-large`**: 64×64.
- **`keycap`**: bg gradient `{colors.key-bg-start}` → `{colors.key-bg-end}`, text `{colors.body}` `{typography.caption-md}`, padding `1px 6px`, ~20px tall, `{rounded.xs}`.

### Navigation
- **`primary-nav`**: bg `{colors.canvas}`, text `{colors.on-dark}`, ~56px tall, `{typography.body-sm-strong}`, 1px `{colors.hairline}` bottom rule. Desktop: wordmark left, centered nav cluster, right cluster (secondary link + white CTA pill). Mobile: hamburger left, wordmark center, CTA pill right; nav collapses to full-screen drawer from the left.

### Footer
- **`footer-section`**: bg `{colors.canvas}`, text `{colors.body}` `{typography.body-sm}`, padding `64px 48px`, 1px `{colors.hairline}` top rule. 6-column link grid; column headers `{typography.body-sm-strong}` `{colors.on-dark}`. Bottom row: wordmark + newsletter input + primary Subscribe. Faint red stripe-gradient echo at the very top of the footer band.

### Inline
- **`link-inline`**: `{colors.on-dark}` text, no underline by default; underline on focus.

## Do's and Don'ts

### Do
- Render the entire site in one continuous dark mode. No light variant.
- Use the white pill for every primary CTA.
- Build elevation from the surface ladder, never drop shadows.
- Enable `font-feature-settings: "calt", "kern", "liga", "ss03"` on body.
- Anchor a command-palette-card mockup as the hero's load-bearing visual.
- Use keycap glyphs inline for shortcuts.
- Reserve the red stripe gradient for the hero band, exactly once per page.
- Use saturated accents only inside illustrations and verdict badge chips (Verity exception).

### Don't
- Don't introduce a light mode.
- Don't add drop shadows.
- Don't tint the primary CTA.
- Don't use saturated accents on text, buttons, or chrome surfaces (verdict badge chips are the sole Verity exception).
- Don't repeat the hero stripe gradient outside the top hero band.
- Don't use Inter without `ss03`.
- Don't pad cards 32px+ on all sides; run tight at 16–24px.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| ultrawide | 1920px+ | Max-width holds 1240px; gutters grow to ~80px |
| desktop-large | 1440px | Default — 3-up pricing, 2-up store grid |
| desktop | 1280px | Narrower gutters |
| desktop-small | 1024px | 3-up pricing → 2+1; nav stays horizontal |
| tablet | 768px | Pricing → 1-up; nav → hamburger drawer |
| mobile | 480px | Single column; hero 64px → ~36px |
| mobile-narrow | 320px | Section padding tightens to 48px |

### Touch Targets
Interactive elements ≥36px. Search bar 44px. Pill tabs ~24–28px visual with padding extending tappable area to 36–40px.

### Collapsing Strategy
- Nav: horizontal → hamburger drawer at 768px; white CTA visible at every breakpoint.
- Hero mockup: 2-column → stacked (mockup below copy) → mobile ~80% width.
- Store grid: 2-up → 1-up at tablet. Pricing: 3-up → 2+1 → 1-up.
- Comparison tables: full → horizontal scroll → vertical card stack.
- Footer: 6-up → 3-up → 2-up → 1-up.
- Section padding: 96px → 64px tablet → 48px mobile.
- Hero headline: 64px → 56px → 44px → 36px.

## Iteration Guide

1. One component at a time; verify every property resolves to a token.
2. Reference tokens directly (`{colors.primary}`, `{rounded.md}`) — do not paraphrase.
3. Add variants as separate entries (`-pressed`, `-disabled`, `-active`).
4. Default body to `{typography.body-md}`; reserve `{typography.display-xl}` for the hero band.
5. At most one solid white pill per fold.
6. Before adding a token, ask if the surface-ladder + 8px-radius + ss03-Inter vocabulary already expresses it.
