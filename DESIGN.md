# DESIGN.md — Jordan Fry Carpentry

The authoritative pattern reference for this site. Style new surfaces from these recipes; when a
surface is not covered, WebFetch the matching preline.co/blocks category, extract its spacing and
type rhythm, and add the recipe here. Don't approximate from memory.

## Direction

**Workshop at golden hour.** Warm near-black ink, amber light, linen text, an elegant display serif.
Editorial and restrained: no icon cards, no carousels, no stock hero photos, no badge rows, no
tooltips. Dark only.

Philosophy checklist before calling any surface done:

1. **Intuitive above all** — a first-time visitor reaches "call Jordan" without thinking.
2. **Fight for less** — every control, label and border justifies itself; one primary action per
   screen; secondary actions recede or fold behind progressive disclosure.
3. **Collapse steps into gestures** — smart defaults, never a question the site could answer itself.
4. **Smoothness is continuity** — state changes in place, layout never jumps, nothing snaps.
5. **The explanation test** — if it needs instructions or a legend, redesign it.

## Tokens (`src/styles/global.css`, Tailwind 4 `@theme`)

### Color

| Token                                                      | Hex                               | Use                                                                           |
| ---------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| `ink-950`                                                  | `#0F0D0B`                         | page background                                                               |
| `ink-900`                                                  | `#171310`                         | elevation 1: bands, call bar                                                  |
| `ink-800`                                                  | `#211C17`                         | elevation 2: panels, dialog chrome                                            |
| `ink-700`                                                  | `#2C2620`                         | elevation 3: hover on elevated surfaces                                       |
| `fg`                                                       | `#F3EBE0`                         | primary text (16.4:1 on ink-950)                                              |
| `fg-2`                                                     | `#B8AC9C`                         | secondary text (8.7:1)                                                        |
| `fg-3`                                                     | `#9A8F7F`                         | muted labels, meta (≥ 4.7:1 on every ink step)                                |
| `amber-400`                                                | `#E9A23B`                         | accent, CTA fill, focus ring (9.0:1 on ink; ink on amber 9.0:1)               |
| `amber-300`                                                | `#F2B65E`                         | hover                                                                         |
| `amber-500` / `600`                                        | `#C7862A` / `#9E6A1F`             | pressed, glow core, gradients                                                 |
| `oak-300`                                                  | `#C99A66`                         | eyebrows and labels on ink (7.7:1)                                            |
| `oak-500` / `700`                                          | `#8B5A2B` / `#4A3320`             | decorative only (placeholders, tints)                                         |
| `line` / `line-strong`                                     | linen at 10% / 40%                | hairlines / input borders (3.4:1 on ink-950; keep inputs on the base surface) |
| `error`                                                    | `#F09A84`                         | form errors (8.9:1)                                                           |
| `--hero-ember` / `--hero-amber` / `--hero-white` (`:root`) | `#7A2E12` / `#E9A23B` / `#FFF1D6` | particle color ramp, read by the shader at mount                              |

Amber is text-safe at any size. Never place text on oak-500/700.

### Type

Fraunces (display, variable `opsz` 9–144 + `wght`) for the wordmark, h1–h3 and quotes; Inter
(variable `wght`) for everything else. Self-hosted via Astro's Fonts API (`--font-fraunces`,
`--font-inter`), two latin woff2 files, both preloaded, no italics.

| Utility               | Size (360 / 768 / 1440 px)     | Font    | Weight                                |
| --------------------- | ------------------------------ | ------- | ------------------------------------- |
| `text-display`        | 48 / 56 / 83 (max 112)         | display | 350, `opsz` 144 pinned on the hero h1 |
| `text-h1`             | 40 / 47 / 63                   | display | 350                                   |
| `text-h2`             | 30 / 33 / 41                   | display | 400                                   |
| `text-h3`             | 20 / 21.5 / 24                 | display | 400                                   |
| `text-quote`          | 24 → 28                        | display | 350                                   |
| `text-lead`           | 18 / 19 / 20.6                 | sans    | 400, `text-fg-2`                      |
| `text-body`           | 16 / 16.6 / 17.6               | sans    | 400                                   |
| `text-sm` / `text-xs` | 14 / 13                        | sans    | 400–500                               |
| `text-label`          | 12, tracking 0.14em, uppercase | sans    | 500, `text-fg-3` or `text-oak-300`    |

`tabular-nums` on years and phone numbers. Nothing heavier than 600.

### Rhythm

- `py-section` = `clamp(5rem, 3rem + 8vw, 10rem)` (80 → 160 px) on every section.
- `mb-12 lg:mb-16` between a section heading row and its content; `mt-6` lead under a heading; `mt-10` action rows.
- `container-site` (72rem) for prose sections, `container-wide` (85rem) for work grids; both pad `px-5 sm:px-8 lg:px-10`.
- Grids: `gap-y-10 gap-x-6 lg:gap-x-8` (work), `gap-10 lg:gap-16` (two-column sections), `gap-x-12 gap-y-16` (testimonials).
- Radii: `rounded-md` (8px) on images, buttons, inputs; `rounded-lg` (14px) only for the lightbox frame.
- Shadows: `shadow-glow` / `shadow-glow-hover` on the primary amber button only.

Baseline extracted from Preline's hero, features, testimonials, contact, footer and gallery blocks
(`max-w-6xl px-4 sm:px-6 lg:px-8`, `py-10 lg:py-14`, `gap-y-12 gap-x-5 lg:gap-x-8`), then one notch
more generous because this site is editorial.

### Motion (the complete vocabulary)

| Name           | Recipe                                                                                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section reveal | `data-reveal` on the section; children start `opacity 0 / translateY(14px)` and transition 0.7s `ease-out-soft` with `--i` × 70ms stagger; one `IntersectionObserver` per page (`lib/reveal.ts`); never on the h1 |
| Image hover    | `scale(1.03)` + `brightness(1.04)` over 0.8s inside an `overflow-hidden` wrapper                                                                                                                                  |
| Header         | gains `bg-ink-950/80 backdrop-blur-md border-b border-line` past 24px of scroll                                                                                                                                   |
| Call bar       | `translate-y-full → 0` over `--duration-base`                                                                                                                                                                     |
| Cover morph    | `view-transition-name: cover-<id>` on the cover figure in the grid and on the detail page; `@view-transition { navigation: auto }`                                                                                |
| Hero particles | see "Hero" below                                                                                                                                                                                                  |

Durations: `--duration-fast` 150ms, `--duration-base` 300ms, `--duration-slow` 600ms. Easing:
`ease-out-soft` `cubic-bezier(0.22, 1, 0.36, 1)`. Everything under `prefers-reduced-motion: reduce`
collapses to instant. No parallax, counters, text splitting, or scroll hijacking.

## Primitive map

| Need                           | Use                                                                                                                                                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focus                          | `focus-ring` utility (2px amber outline, 4px offset) on every interactive element                                                                                                                                                                           |
| Primary action                 | `inline-flex h-14 items-center px-8 rounded-md bg-amber-400 text-ink-950 font-medium shadow-glow hover:bg-amber-300 hover:shadow-glow-hover transition duration-(--duration-base) ease-out-soft focus-ring`                                                 |
| Quiet action                   | `text-sm text-fg-2 underline underline-offset-8 decoration-line-strong hover:text-fg hover:decoration-amber-400`                                                                                                                                            |
| Bordered action (header phone) | `inline-flex h-10 items-center px-4 rounded-md border border-line-strong text-sm font-medium text-fg hover:border-amber-400`                                                                                                                                |
| Label / eyebrow                | `text-label uppercase text-fg-3` (or `text-oak-300` for emphasis)                                                                                                                                                                                           |
| Hairline divider               | `border-t border-line`                                                                                                                                                                                                                                      |
| Input                          | `block w-full h-14 px-0 bg-transparent border-0 border-b border-line-strong text-body text-fg placeholder:text-fg-3 focus:border-amber-400 focus:outline-none transition-colors` with a visible `<label class="block text-label uppercase text-fg-3 mb-2">` |
| Modal                          | native `<dialog>` (`Lightbox.astro`), `showModal()`, `closedby="any"` + backdrop-click fallback                                                                                                                                                             |
| Disclosure                     | native `<details>` / `<summary>` (services rows)                                                                                                                                                                                                            |
| Status feedback                | `role="status"` block swapped in place; never `alert()`                                                                                                                                                                                                     |
| Image                          | `WorkImage.astro` (wraps `astro:assets` `<Image>`; responsive widths only for raster sources)                                                                                                                                                               |

## Layout

`Base.astro`: skip link → `<slot name="backdrop" />` (fixed layers below content; home fills it with
`HeroCanvas`) → `Header` (`sticky top-0 z-30 h-16`) → `<main id="main" tabindex="-1" class="relative z-10">`
→ `Footer` → `CallBar` (`z-40`, `md:hidden`). `body`/`main` never receive `transform` or `filter`
(they would break the fixed canvas). The body reserves the call bar height on mobile from first paint.

Navigation: Work · Services · About + the phone number as a bordered `tel:` button on md+. No
hamburger at any size. Contact is not a nav item; it is the CTA.

## Section recipes

**Hero** — `relative min-h-[92svh] flex flex-col justify-end pb-20 md:pb-28`, 92svh so the first
project image peeks in as the scroll cue. `h1#hero-name` = two block spans (`Jordan` / `Fry`),
`font-display text-display font-[350] text-fg`, `font-variation-settings: "opsz" 144`; fully visible at
first paint (LCP), dimmed to 32% by `.is-lit` while the particles form the same glyphs. Positioning
line `mt-6 max-w-xl text-lead text-fg-2 text-pretty`. Actions `mt-10 flex flex-wrap items-center
gap-x-8 gap-y-4`: one primary (mobile "Call Jordan" `tel:`, md+ "Start a conversation" `#contact`) +
one quiet link "See the work".

**Work grid** — heading row `flex items-end justify-between mb-12 lg:mb-16`; `grid lg:grid-cols-12
gap-y-10 gap-x-6 lg:gap-x-8`; pattern by index: `col-span-7 aspect-[4/3]`, `col-span-5 aspect-[3/4]
lg:mt-24`, `col-span-5 aspect-square lg:-mt-16`, `col-span-7 aspect-[16/10]`, `col-span-8 col-start-3
aspect-[3/2]`, `col-span-4 aspect-[3/4] lg:-mt-20`. Card: `group relative block overflow-hidden
rounded-md focus-ring`, cover figure with `view-transition-name`, hover scrim `absolute inset-x-0
bottom-0 p-6 md:p-8 bg-gradient-to-t from-ink-950/85 opacity-0 group-hover:opacity-100
group-focus-visible:opacity-100` with `text-h3` title and `text-label text-oak-300` "{type} · {town}";
on `touch:` the scrim is hidden and a static caption shows below.

**Services** — `ul.mt-12.border-t.border-line` of `<details class="group border-b border-line">`;
summary `flex items-baseline gap-6 md:gap-10 py-6 md:py-8 list-none cursor-pointer focus-ring`:
index `text-label text-fg-3 tabular-nums w-8`, name `font-display text-h2 group-hover:text-amber-300`,
trailing hairline "+" rotating 45° when open; body `pb-8 max-w-2xl text-body text-fg-2`. Multiple may
stay open; height animates via `::details-content` where supported.

**About** — `grid lg:grid-cols-12 gap-10 lg:gap-16 items-start`; portrait `lg:col-span-5
aspect-[4/5] rounded-md`; text `lg:col-span-6 lg:col-start-7` (h2, lead, body, `space-y-6`);
credential strip `mt-10 pt-8 border-t border-line flex flex-wrap gap-x-10 gap-y-3 text-label
uppercase text-fg-3`, three plain-text items.

**Testimonials** — small `text-label` heading; `grid lg:grid-cols-3 gap-x-12 gap-y-16`;
`<figure><blockquote class="quote text-quote font-[350] text-pretty">` + `<figcaption class="mt-6
text-sm">` name + `text-fg-3` " · town". Static.

**Contact** — `grid lg:grid-cols-12 gap-12 lg:gap-16`. Left `lg:col-span-5`: h2, lead, `dl` of
Call / Text (`md:hidden`) / Email rows ≥ 44px, then the Talk / Plan / Build strip (`mt-12 pt-8
border-t border-line`, `text-label text-oak-300` titles + one sentence). Right `lg:col-span-6
lg:col-start-7`: form `space-y-8`, three underline inputs, amber submit `h-14 px-8`; on success the
fieldset crossfades out and a `role="status" tabindex="-1"` block of the same height crossfades in.

**Project detail** — full-bleed cover `aspect-[3/2] max-h-[80svh] object-cover` with `priority`;
`container-site pt-12 md:pt-16` title `text-h1` + summary `text-lead text-fg-2 max-w-2xl`; meta row
`mt-10 grid grid-cols-3 gap-6 border-y border-line py-6` (`dt` label / `dd` value); body `max-w-2xl
text-body text-fg-2 space-y-5`; gallery `mt-16 grid grid-cols-2 lg:grid-cols-12 gap-3 lg:gap-6`
alternating `col-span-7` / `col-span-5`, each image in a `<button aria-label="Open photo n of N">`;
next/previous `mt-24 border-t border-line grid md:grid-cols-2`, circular order, plus "All work".

**Footer** — `border-t border-line py-12 lg:py-16 container-site`; `flex flex-col md:flex-row
md:justify-between gap-8`: wordmark + `text-sm text-fg-2` area line / phone + email links; bottom
row `mt-10 text-xs text-fg-3 flex flex-wrap gap-x-6`: copyright · licensed · HIC number.

**Call bar (mobile)** — `<nav aria-label="Call or text">`, `fixed inset-x-0 bottom-0 z-40 md:hidden
grid grid-cols-2`, cells `h-14` + safe-area padding, "Call Jordan" (amber) / "Text Jordan" (ink-900,
hairline top). Appears only after the hero CTA leaves the viewport; hides while the contact links are
visible or an input is focused, so exactly one primary action is on screen at any scroll position.

## Hero (three.js) — `src/lib/hero/`

Stateless vertex-shader particles (one `Points` draw call, no GPGPU): amber dust drifts in a tilted
light shaft, coalesces into the h1's glyphs (targets sampled from the same font at a fixed 200px,
normalised to the measured h1 line boxes), parts around a damped pointer with a decaying trail, and
dissolves into sparse ambient dust as the hero scrolls away. Orthographic camera in CSS pixels.
Quality tiers 60k / 24k / 8k motes with a frame-time probe that steps down. Reduced motion renders one
static frame. WebGL absent: the CSS light shaft and the full-opacity h1 are the designed state.
Additive, premultiplied sprites; no tone mapping; colors from the `hero-*` tokens.
