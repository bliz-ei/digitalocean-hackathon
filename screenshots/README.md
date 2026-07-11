# Design Reference Screenshots

Captured with `npx playwright screenshot --full-page --viewport-size=<w>,<h> --wait-for-timeout=4000 <url> <file>`.
These are inspiration references for Verity's Raycast-derived design system (see `/DESIGN.md` at repo root).

| File | Dimensions | Notes |
|---|---|---|
| `raycast-home-desktop-1280.png` | 1280×15626 | The canonical reference for the whole system: the red diagonal-`hero-stripe-band` gradient at the very top of the hero (used once per page, per DESIGN.md), the white `button-primary` CTA pill against the near-black `{colors.canvas}` (#07080a), the `command-palette-card` mockup anchoring the hero as the load-bearing visual, hairline 1px borders (`{colors.hairline}`) on every card with no drop shadows, and the surface ladder (canvas → surface → surface-elevated → surface-card) creating depth down the page. Also shows the 96px `{spacing.section}` rhythm between full-bleed dark sections and Inter with the ss03 alternate-`g` rendering throughout headings.
| `raycast-home-mobile-375.png` | 375×15453 | Mobile collapse reference: `primary-nav` folds to hamburger-left / wordmark-center / CTA-pill-right pattern, stacked single-column card grids (feature cards, store previews) replacing the desktop multi-column layout, and the footer's 6-column link grid collapsing to a 1-up stack — directly informs Verity's mobile nav-drawer and footer breakpoints.
| `raycast-store-desktop-1280.png` | 1280×4330 | Reference for `store-extension-card`: horizontal card layout (48px `app-icon-tile` left, name/author/description center, `install-button` right), hairline borders on a 2-up desktop grid, and the `store-search-bar` treatment (`{colors.surface-elevated}` fill, magnifier icon, ~44px tall) — maps directly to any extension/marketplace-style listing Verity might need.
| `raycast-pricing-desktop-1280.png` | 1280×7078 | Reference for `pricing-tier-card` / `-featured`: 3-up desktop grid, hairline-bordered default tiers on `{colors.surface}` vs. the elevated/featured tier on `{colors.surface-elevated}`, `heading-xl` tier names, and body-lg tier descriptions — useful if Verity ever needs a tiered-plan or feature-comparison surface.
| `aside-home-desktop-1280.png` | 1280×7700 | Secondary dark-mode inspiration outside the Raycast family: shows an alternate take on hairline-carded feature sections and monochrome-first CTA styling, useful as a cross-check that Verity's surface-ladder-without-shadows approach reads well against a different studio's dark-mode conventions.
| `aside-home-mobile-375.png` | 375×7224 | Mobile counterpart to the above — cross-check reference for how a comparable dark, hairline-card-based site collapses its hero and feature grid at 375px width, useful alongside the Raycast mobile shot when validating Verity's own mobile stacking rules.

## Capture notes
All 6 target shots captured successfully with `npx playwright install chromium` + `playwright screenshot --full-page`. No failures — no bot-blocking or headless-detection issues were encountered on either raycast.com or aside.com.
