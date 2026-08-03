# Design Language & UX Standards

The bar is "awwwards-tier": every screen should feel deliberately designed,
not assembled. These rules ARE the Sidelick look — deviating from them is a
design decision that needs a reason.

## Typography

- **Fraunces** (`font-display`) for page titles, section headings, stat values,
  and the wordmark. **Plus Jakarta Sans** for body/UI text.
- Page headers follow the hero-band pattern: eyebrow (uppercase, xs, muted) →
  `font-display` title → one-line muted subtitle.

## Color & tone

- Tokens only — never raw hex in components. Coral `primary` = action/brand;
  teal `trust` = safety/verification/success-adjacent; `accent-subtle` washes
  for warmth; `danger`/`warning` for their literal meanings.
- Chip tone carries meaning: care/safety chips teal, brand/action coral,
  neutral facts muted. Text on a tinted background uses that family's strong
  shade, never plain black/gray.

## Surfaces & elevation

- Cards: `rounded-2xl border border-border bg-surface shadow-sm hover:shadow-md`
  + `.lift`. Focal cards `shadow-md`; primary CTAs `shadow-glow`. Hero bands:
  `rounded-3xl` with blurred `accent-subtle`/`trust-subtle` washes.
- Brand-tinted shadows only (already in the Tailwind scale) — never plain black.

## Motion

- Entrances: CSS `slk-rise` with staggered delays (cap the stagger at ~8 items),
  not per-item JS animation. Micro-interactions (heart, chips) may use
  framer-motion springs.
- **Every animation respects `prefers-reduced-motion`** — no exceptions.
- Loading: skeletons for content, `LogoLoader` for brand moments only.

## States are part of the design

Every data surface ships with all four states designed: loading (skeleton),
empty (illustrated, with a CTA), error (honest message), and populated. An
empty state that says nothing, or an error that looks like loading, is a bug.

## Copy

- Warm, direct, second person. Explain the *benefit*, not the mechanism.
- Species/service/rail-aware: never show a dog-specific string to a cat owner
  or a "sit" label on a boarding booking. When adding a variant, grep the whole
  frontend for copy tied to the old default and fix every hit.
- The brand is one word: **Sidelick**. Never split or stack it.

## Accessibility

- Interactive icons get `aria-label`; toggles get `aria-pressed`; icon-only
  meaning gets a `title` tooltip. Tab lists use real `role="tablist"`.
- Contrast per WCAG AA (the palette is verified — don't invent colors).

## Definition of done

- [ ] Fraunces headings + hero-band pattern where a page has a header
- [ ] Tokens only; chip tones match meaning
- [ ] All four UI states designed
- [ ] Reduced motion respected; stagger capped
- [ ] Copy audited for variants; a11y labels present
