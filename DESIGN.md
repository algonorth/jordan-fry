# DESIGN.md — Jordan Fry Carpentry

The authoritative pattern reference for this site. Style new surfaces from these recipes; when a
surface is not covered, WebFetch the matching preline.co/blocks category, extract its spacing and
type rhythm, and add the recipe here. Don't approximate from memory.

## Direction

**Workshop at golden hour.** Warm near-black ink, amber light, linen text, an elegant display serif,
and shop drawings where photographs will one day go. Editorial and restrained: no icon cards, no
carousels, no stock hero photos, no badge rows, no tooltips. Dark only.

Two motifs carry the whole site and nothing else is added on top of them:

- **Dust in a light shaft** — the particle hero, the lamp glow and motes on every drawing sheet, the
  film grain over the page, the amber glow at the foot of the footer.
- **The drawing sheet** — hairline rules that draw in, small-caps indices (`01 · Selected work`),
  title-block captions under every project, the sheets themselves.

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
| `ink-900`                                                  | `#171310`                         | elevation 1: bands, call bar, image grounds, drawing sheets                   |
| `ink-800`                                                  | `#211C17`                         | elevation 2: panels, dialog chrome                                            |
| `ink-700`                                                  | `#2C2620`                         | elevation 3: hover on elevated surfaces                                       |
| `fg`                                                       | `#F3EBE0`                         | primary text (16.4:1 on ink-950)                                              |
| `fg-2`                                                     | `#B8AC9C`                         | secondary text (8.7:1)                                                        |
| `fg-3`                                                     | `#9A8F7F`                         | muted labels, meta (≥ 4.7:1 on every ink step)                                |
| `amber-400`                                                | `#E9A23B`                         | accent, CTA fill, focus ring, drawing outlines (9.0:1 on ink)                 |
| `amber-300`                                                | `#F2B65E`                         | hover                                                                         |
| `amber-500` / `600`                                        | `#C7862A` / `#9E6A1F`             | pressed, glow core, gradients                                                 |
| `oak-300`                                                  | `#C99A66`                         | indices, eyebrows and labels on ink (7.7:1); secondary drawing lines          |
| `oak-500` / `700`                                          | `#8B5A2B` / `#4A3320`             | decorative only                                                               |
| `line` / `line-strong`                                     | linen at 10% / 40%                | hairlines / input borders (3.4:1 on ink-950; keep inputs on the base surface) |
| `error`                                                    | `#F09A84`                         | form errors (8.9:1)                                                           |
| `--hero-ember` / `--hero-amber` / `--hero-white` (`:root`) | `#7A2E12` / `#E9A23B` / `#FFF1D6` | particle color ramp, read by the shader at mount                              |

Amber is text-safe at any size. Never place text on oak-500/700.

### Type

Fraunces (display, variable `opsz` 9–144 + `wght`) for the wordmark, h1–h3, quotes and card titles;
Inter (variable `wght`) for everything else, including the technical lettering on the drawing sheets.
Self-hosted via Astro's Fonts API (`--font-fraunces`, `--font-inter`), two latin woff2 files, both
preloaded, no italics.

| Utility               | Size (360 / 768 / 1440 px)     | Font    | Weight                                |
| --------------------- | ------------------------------ | ------- | ------------------------------------- |
| `text-display`        | 64 / 82 / 126 (max 176)        | display | 350, `opsz` 144 pinned on the hero h1 |
| `text-h1`             | 40 / 47 / 63                   | display | 350 (also the footer wordmark)        |
| `text-h2`             | 32 / 47 / 56                   | display | 400                                   |
| `text-row`            | 24 / 30 / 39                   | display | 400, services rows                    |
| `text-h3`             | 20 / 21.5 / 24                 | display | 400, card and step titles             |
| `text-quote`          | 24 → 28                        | display | 350                                   |
| `text-lead`           | 18 / 19 / 20.6                 | sans    | 400, `text-fg-2`                      |
| `text-body`           | 16 / 16.6 / 17.6               | sans    | 400                                   |
| `text-sm` / `text-xs` | 14 / 13                        | sans    | 400–500                               |
| `text-label`          | 12, tracking 0.14em, uppercase | sans    | 500, `text-fg-3` or `text-oak-300`    |

`tabular-nums` on years, indices, hours and phone numbers. Nothing heavier than 600. The scrollbar
is `scrollbar-color: ink-700 ink-950`. Placeholder facts never render as "TODO": the school stays
unnamed and the HIC number (`hasHic`) appears in the footer, credentials and JSON-LD only once it is
real; the markers live in code comments so `grep TODO` still finds them. Custom
`--spacing-*` tokens are off limits: Tailwind reads them as spacing values, so a `--spacing-block`
turns `inline-block` into an `inline-size` (this bit us once).

### Rhythm

- `py-section` = `clamp(5rem, 3rem + 8vw, 10rem)` (80 → 160 px) on every section.
- Section head → content: `mt-12 lg:mt-16`; `mt-6` lead under a heading; `mt-10` action rows.
- `container-site` (72rem) for prose sections, `container-wide` (85rem) for work grids; both pad `px-5 sm:px-8 lg:px-10`.
- Grids: `gap-y-14 gap-x-6 lg:gap-x-8 lg:gap-y-16` (work), `gap-10 lg:gap-16` (two-column sections), `gap-x-12 gap-y-16` (testimonials).
- Radii: `rounded-md` (8px) on images, buttons, inputs; `rounded-lg` (14px) only for the lightbox frame.
- Shadows: `shadow-glow` / `shadow-glow-hover` on the primary amber button only.

Baseline extracted from Preline's hero, features, testimonials, contact, footer and gallery blocks
(`max-w-6xl px-4 sm:px-6 lg:px-8`, `py-10 lg:py-14`, `gap-y-12 gap-x-5 lg:gap-x-8`), then one notch
more generous because this site is editorial.

### Motion (the complete vocabulary)

| Name            | Recipe                                                                                                                                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section reveal  | `data-reveal` on the group; children start `opacity 0 / translateY(14px)` and transition 0.7s `ease-out-soft` with `--i` × 70ms stagger; one `IntersectionObserver` per page (`lib/reveal.ts`); never on the h1                              |
| Rule draw-in    | `.rule` (1px `line`) as a direct child of a `data-reveal` group scales from `scaleX(0)` to 1 over 1.2s, origin left                                                                                                                          |
| Image wipe      | `.reveal-img` (the figure) starts `clip-path: inset(0 0 100% 0 round 8px)` and opens over 1.1s; its `.work-img` settles from `scale: 1.08` to 1 over 1.5s; the card itself is `.reveal-self` (no fade), its `.card-meta` follows 350ms later |
| Image hover     | `transform: scale(1.03)` + `brightness(1.06)` over 0.8s inside an `overflow-hidden` wrapper; card title turns `amber-300`                                                                                                                    |
| Nav underline   | `link-nav`: a 1px `currentColor` underline grows from the left over `--duration-base`; stays for `aria-current="page"`                                                                                                                       |
| Header          | gains `bg-ink-950/80 backdrop-blur-md border-b border-line` past 24px of scroll                                                                                                                                                              |
| Call bar        | `translate-y-full → 0` over `--duration-base`                                                                                                                                                                                                |
| Page transition | `@view-transition { navigation: auto }`; root fades out 0.3s and fades/rises in 0.55s (8px); `view-transition-name: cover-<id>` on the cover figure in the grid and on the detail page morphs the cover                                      |
| Hero particles  | see "Hero" below                                                                                                                                                                                                                             |

Durations: `--duration-fast` 150ms, `--duration-base` 300ms, `--duration-slow` 600ms. Easing:
`ease-out-soft` `cubic-bezier(0.22, 1, 0.36, 1)`. Everything under `prefers-reduced-motion: reduce`
collapses to instant (rules and images simply present), except the particle hero and its headline
handoff (see "Hero" below). No parallax, counters, text splitting, or scroll hijacking.

## Primitive map

| Need                           | Use                                                                                                                                                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focus                          | `focus-ring` utility (2px amber outline, 4px offset) on every interactive element                                                                                                                                                                                          |
| Primary action                 | `btn-primary`: `inline-flex h-14 items-center px-8 rounded-md bg-amber-400 text-ink-950 font-medium shadow-glow hover:bg-amber-300 hover:shadow-glow-hover`                                                                                                                |
| Quiet action                   | `link-quiet`: `text-sm text-fg-2 underline underline-offset-8 decoration-line-strong hover:text-fg hover:decoration-amber-400`                                                                                                                                             |
| Nav link                       | `link-nav` (see Motion)                                                                                                                                                                                                                                                    |
| Bordered action (header phone) | `inline-flex h-10 items-center px-4 rounded-md border border-line-strong text-sm font-medium text-fg hover:border-amber-400`                                                                                                                                               |
| Section head                   | `SectionHead.astro`: `.rule` + `mt-5` eyebrow row (`text-label uppercase text-fg-3`, index in `text-oak-300 tabular-nums`, optional `slot="aside"`) + optional `mt-8 md:mt-10 text-h2` title; without a title the eyebrow is the section's `h2`; `static` skips the reveal |
| Label / eyebrow                | `text-label uppercase text-fg-3` (or `text-oak-300` for emphasis and indices)                                                                                                                                                                                              |
| Hairline divider               | `border-t border-line`; `.rule` when it should draw in                                                                                                                                                                                                                     |
| Input                          | `block w-full h-14 px-0 bg-transparent border-0 border-b border-line-strong text-body text-fg placeholder:text-fg-3 focus:border-amber-400 focus:outline-none transition-colors` with a visible `<label class="block text-label uppercase text-fg-3 mb-2">`                |
| Modal                          | native `<dialog>` (`Lightbox.astro`), `showModal()`, `closedby="any"` + backdrop-click fallback; visible `n / N` counter in `text-label text-oak-300` and the photo's alt as a `text-sm text-fg-2` caption under the image                                                 |
| Disclosure                     | native `<details>` / `<summary>` (services rows)                                                                                                                                                                                                                           |
| Status feedback                | `role="status"` block swapped in place; never `alert()`                                                                                                                                                                                                                    |
| Image                          | `WorkImage.astro` (wraps `astro:assets` `<Image>`; responsive widths only for raster sources); image grounds are `bg-ink-900` so a drawing sheet's edge is invisible                                                                                                       |
| Grain                          | `.grain`: fixed, `z-index: 45`, `pointer-events: none`, one 180px `feTurbulence` tile tinted linen at 7% opacity, rendered once by `Base.astro`                                                                                                                            |

## Layout

`Base.astro`: skip link → `<slot name="backdrop" />` (fixed layers below content; home fills it with
`HeroCanvas`) → `.grain` → `Header` (`sticky top-0 z-30 h-16`, carries `id="top"`) →
`<main id="main" tabindex="-1" class="relative z-10">` → `Footer` → `CallBar` (`z-40`, `md:hidden`).
`body`/`main` never receive `transform` or `filter` (they would break the fixed canvas). The body
reserves the call bar height on mobile from first paint.

Navigation: Work · Services · About (`link-nav`) + the phone number as a bordered `tel:` button on
md+. No hamburger at any size. Contact is not a nav item; it is the CTA.

Sections are numbered in page order (`sections` in `data/copy.ts`): 01 Selected work · 02 Services ·
03 About · 04 Kind words · 05 Contact. Every one opens with `SectionHead`.

## Section recipes

**Hero** — `relative min-h-[88svh] flex flex-col justify-end pb-16 md:pb-24`, 88svh so the first
section head peeks in as the scroll cue (it is rendered `static`, without the reveal). Inside:
`lg:grid lg:grid-cols-12 lg:items-end lg:gap-10`; the headline column is `lg:col-span-9`, the
at-a-glance list `lg:col-span-3 justify-self-end text-right text-label uppercase text-fg-3
space-y-3` (town, `Est. year`, `Licensed & insured`; hidden below lg). `h1#hero-name` = two block
spans (`Jordan` / `Fry`), `font-display text-display font-[350] text-fg`, `font-variation-settings:
"opsz" 144`; `html[data-hero-intro="pending"]` (set by an inline pre-paint probe when the hero will
run) keeps it invisible so the name appears exactly once, formed by the dust; `.is-forming` on the
hero takes over on the first rendered frame, and `.is-lit` raises the headline to 100% over 1.8s
while the name motes fade out. Without WebGL the flag is never set and the headline is the LCP
element as plain text; with it, the lead paragraph is. Positioning line `mt-8 max-w-xl text-lead
text-fg-2 text-pretty`. Actions `mt-10 flex flex-wrap items-center gap-x-8 gap-y-4`: one primary
(mobile "Call Jordan" `tel:`, md+ "Start a conversation" `#contact`) + one quiet link "See the work".

**Work grid** — `SectionHead` (eyebrow only) then `mt-10 lg:mt-14`; `grid md:grid-cols-2
lg:grid-cols-12 gap-y-14 gap-x-6 lg:gap-x-8 lg:gap-y-16` (one column on phones, two on tablets, the
editorial 12-column rhythm from lg; the fifth card spans both tablet columns); pattern by index: `col-span-7 aspect-[4/3]`, `col-span-5
aspect-[3/4] lg:mt-24`, `col-span-5 aspect-square lg:-mt-16`, `col-span-7 aspect-[16/10]`,
`col-span-8 col-start-3 aspect-[3/2]`, `col-span-4 col-start-1 aspect-[3/4]` (no negative offset on
the sixth: it would cover the fifth card's caption). Card (`WorkCard.astro`): `a.reveal-self.group`,
cover `figure.reveal-img` with `view-transition-name`, then the caption row `.card-meta mt-4 flex
flex-wrap items-baseline justify-between`: index `text-label text-oak-300 tabular-nums` + title
`font-display text-h3 text-fg` on the left, `{type} · {town} · {year}` in `text-label uppercase
text-fg-3` on the right. No hover scrim: the caption is always there, the image brightens and
scales, the title turns amber. "All work" sits `mt-12 lg:mt-16 justify-end` under the home grid.

**Work index** — `pt-12 md:pt-20`; head block `mb-12 lg:mb-16` with a `text-label` count line
(`6 projects · 2023–2025`, derived from the collection), `text-h1` title, `max-w-2xl text-lead` lead.

**Services** — `SectionHead` with title, then `ul.mt-12.lg:mt-16.border-t.border-line` of
`<details class="disclosure group border-b border-line">`; summary `flex items-baseline gap-6
md:gap-10 py-6 md:py-8 list-none cursor-pointer focus-ring`: index `text-label text-oak-300
tabular-nums w-8`, name `font-display text-row group-hover:text-amber-300`, trailing hairline "+"
rotating 45° when open; body `grid gap-8 md:gap-12 pb-10 ps-14 md:ps-18 md:grid-cols-[1fr_auto]`:
the sentence `max-w-xl text-body text-fg-2` and, from `service.example`, that project's cover in a
`md:w-64 aspect-[4/3] rounded-md` figure captioned `Example` (label) + title (`text-sm text-fg`,
amber on hover), linking to the project. Multiple rows may stay open; height animates via
`::details-content` where supported.

**About** — `SectionHead` with title; `mt-12 lg:mt-16 grid lg:grid-cols-12 gap-10 lg:gap-16
items-start`; portrait `lg:col-span-5` as `.reveal-self > figure.reveal-img aspect-[4/5]
rounded-md bg-ink-900`; text `lg:col-span-6 lg:col-start-7` (lead in `text-fg`, body in `text-fg-2
mt-6`); credential strip `mt-10 pt-8 border-t border-line flex flex-wrap gap-x-10 gap-y-3
text-label uppercase text-fg-3`, three plain-text items.

**Testimonials** — `SectionHead` (eyebrow only, "Kind words"); `mt-12 lg:mt-16 grid lg:grid-cols-3
gap-x-12 gap-y-16`; each `<figure>` opens with a `3.5rem` Fraunces “ in `text-amber-400` (`.mark`,
`line-height 0.7`, aria-hidden), then `<blockquote class="quote text-quote font-[350] text-pretty">`

- `<figcaption class="mt-6 text-sm">` name + `text-fg-3` " · town". Static.

**Contact** — `SectionHead` with title; `mt-12 lg:mt-16 grid lg:grid-cols-12 gap-12 lg:gap-16`.
Left `lg:col-span-5`: lead (`contact.lead` with the form, `contact.leadNoForm` without), `dl` of
Call / Text (`md:hidden`) / Email / Hours rows ≥ 44px (hours derived from `site.hours` by
`hoursDisplay`). Right `lg:col-span-6 lg:col-start-7`: the form when `PUBLIC_WEB3FORMS_KEY` is set
(`space-y-8`, three underline inputs, amber submit `h-14 px-8`; on success the fieldset crossfades
out and a `role="status" tabindex="-1"` block of the same height crossfades in), otherwise the
Talk / Plan / Build steps as `ol.grid.gap-8.border-t.border-line.pt-8`, each `grid-cols-[3rem_1fr]`
with an `oak-300` index, `text-h3` title and `text-body text-fg-2` sentence. With the form present
the steps sit under the left column instead (`mt-12 pt-8 border-t`, label titles, `text-sm`).

**Project detail** — the cover layout follows `orientation`. Landscape: full-bleed
`figure.aspect-[3/2].max-h-[82svh].bg-ink-900` with `object-contain` (a drawing sheet is never
cropped; a photo is pillarboxed on ink-900), then `container-site pt-12 md:pt-16`. Portrait:
`container-site grid lg:grid-cols-12 lg:items-end gap-10 lg:gap-16 pt-6 md:pt-10`, the
`aspect-[3/4] rounded-md` figure in `lg:col-span-6` and the title block beside it. Either way:
`text-label` `{type} · {year}`, `mt-5 text-h1` title, `mt-6 max-w-2xl text-lead text-fg-2` summary;
meta row `mt-10 grid grid-cols-3 gap-6 border-y border-line py-6` (`dt` label / `dd` value); body
`max-w-2xl text-body text-fg-2 space-y-5`; gallery `mt-16 grid grid-cols-2 lg:grid-cols-12 gap-3
lg:gap-6` alternating `col-span-7` / `col-span-5`, each image in a `<button
class="reveal-self reveal-img" aria-label="Open photo n of N">`; next/previous `mt-24 border-t
border-line grid md:grid-cols-2`, circular order, plus "All work".

**Footer** — `relative overflow-hidden border-t border-line` with `.footer-glow` (amber radial at
the bottom-left, 12%); `container-site py-16 lg:py-24`; `flex flex-col md:flex-row md:items-end
md:justify-between gap-12 md:gap-16`: wordmark in `font-display text-h1 font-[350]` (`opsz` 144) +
`mt-5 max-w-md text-sm text-fg-2` area line on the left, a `dl` of Call / Email / Hours
(`sm:grid-cols-[auto_auto] md:text-right text-sm`) on the right; bottom row `mt-14 pt-6 border-t
border-line text-xs text-fg-3 flex justify-between`: copyright · licensed · HIC number, and a
"Back to top" `link-quiet` to `#top`.

**Call bar (mobile)** — `<nav aria-label="Call or text">`, `fixed inset-x-0 bottom-0 z-40 md:hidden
grid grid-cols-2`, cells `h-14` + safe-area padding, "Call Jordan" (amber) / "Text Jordan" (ink-900,
hairline top). Appears only after the hero CTA leaves the viewport; hides while the contact links are
visible or an input is focused, so exactly one primary action is on screen at any scroll position.

**404** — `container-site min-h-[70svh] flex flex-col justify-center py-section`: `text-label` "404",
`text-h1` heading, `text-lead` line, quiet link home.

## Drawing sheets (`scripts/make-drawings.mjs`)

Until real photographs exist, every project image is a shop drawing: plan, elevation, section or
detail, drawn from the project's own copy (the deck really is 14 × 20 with a mid landing, the
balusters really are under 4" apart). One generated SVG per image, deterministic, `npm run
placeholders` regenerates all 25 from the `PROJECTS` table.

Sheet anatomy, at 1600 × 1200 / 1200 × 1600 (about portrait 1200 × 1500): `ink-900` ground, a 40px
dot grid of linen at 7%, a lamp glow from one upper corner, 36–64 amber motes along its shaft (never
over the title block), a linen frame at 16%, a paper-grain `feTurbulence` at 3.5%, and a title block
(`PROJECT · LOCATION · DRAWING · SCALE · SHEET`; portrait sheets drop `SCALE`). Line classes:
`.o` outline amber 3.2px · `.s` secondary oak 2px · `.h` hatch amber 1.4px at 26% (as pattern fills)
· `.x` hidden oak dashed · `.d` dimensions linen 1.5px at 38% with architectural tick ends · `.f` /
`.f2` amber fills at 7% / 14%. Lettering is Inter 400 as glyph outlines (`fontkitten`), deduplicated
per sheet, so no font loads at render time; labels are uppercase, tracked 0.08–0.16em.

Replacing a sheet with a photo: drop the JPEG beside `index.md`, point `cover:` / `gallery:` at it,
write a real `alt`, set `placeholder: false`. Nothing else changes.

## Hero (three.js) — `src/lib/hero/`

Stateless vertex-shader particles (one `Points` draw call, no GPGPU): amber dust drifts in a tilted
light shaft, coalesces into the h1's glyphs (targets sampled from the same font at a fixed 200px,
normalised to the measured h1 line boxes), parts around a damped pointer with a decaying trail, and
dissolves into sparse ambient dust as the hero scrolls away. Orthographic camera in CSS pixels.
Quality tiers 60k / 24k / 8k motes with a frame-time probe that steps down. The OS reduced-motion
flag is ignored on purpose (Windows sets it whenever "Show animations" is off, and the dust has no
parallax or zoom); `?motion=static` renders the finished frame for checks. WebGL absent: the CSS light
shaft and the full-opacity h1 are the designed state.
Additive, premultiplied sprites; no tone mapping; colors from the `hero-*` tokens.
