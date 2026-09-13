# Jordan Fry — carpenter and contractor

A static site: Astro 7, Tailwind CSS 4, three.js. No backend. Deploys to GitHub Pages from `main`.

```bash
npm run dev        # http://localhost:4321
npm run build      # type check + static build into dist/
npm run preview    # serve dist/
npm test           # Playwright smoke tests against dist/ (run `npm run build` first)
npm run format     # Prettier
npm run placeholders   # regenerate the shop-drawing placeholder sheets
npm run og         # regenerate public/og.png with the real fonts
```

## Where things live

| What                                                                 | Where                                                                                                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Business facts (phone, email, area, hours, HIC number)               | `src/data/site.ts`                                                                                                      |
| Copy (hero line, about, process, contact, form, footer, page titles) | `src/data/copy.ts`                                                                                                      |
| Services and testimonials                                            | `src/data/services.ts`, `src/data/testimonials.ts`                                                                      |
| Projects                                                             | `src/content/work/<slug>/index.md` with its photos beside it                                                            |
| Portrait                                                             | `src/assets/portrait.svg` (a drawing of the shop; replace with a 1200×1500 JPEG and update the import in `About.astro`) |
| Placeholder drawings                                                 | `scripts/make-drawings.mjs` (one function per sheet, `PROJECTS` table at the bottom)                                    |
| Design tokens and recipes                                            | `DESIGN.md`, `src/styles/global.css`                                                                                    |
| Particle hero                                                        | `src/lib/hero/` (loaded lazily by `HeroCanvas.astro`)                                                                   |

Every placeholder that needs real data contains the literal `TODO:`:

```bash
grep -rn "TODO" src scripts --include=*.ts --include=*.md --include=*.mjs
```

## Replacing placeholder photos

Until there are photographs, every project image is a generated shop drawing (plan, elevation,
section or detail, drawn from the project's own copy) on an ink drawing sheet with a title block, and
each sheet draws itself line by line as it scrolls into view. See "Drawing sheets" in `DESIGN.md`. To replace one: drop JPEGs next to the project's `index.md` (long
edge 1600 for covers and galleries, 2400 if a cover should fill a large screen), point `cover:` /
`gallery:` at them, write a real `alt`, and set `placeholder: false`. Responsive `srcset` variants
switch on automatically for raster images. A cover is shown whole at its own aspect beside the
project title (never cropped), and in the work grid it fills a slot of the same aspect: keep a cover
at the aspect of the slot its `order` lands in (4:3, 3:4, 1:1, 16:10, 3:2, 4:3) so nothing is cut.

## Contact form

Create a free access key at web3forms.com for Jordan's email, then:

- locally: `.env` with `PUBLIC_WEB3FORMS_KEY=...`
- on GitHub: repository variable `PUBLIC_WEB3FORMS_KEY`

Without a key the form is omitted and the contact section shows the call, text and email links only.

## Deploying

1. Push to GitHub. In Settings → Pages set **Source: GitHub Actions**. The workflow in
   `.github/workflows/deploy.yml` builds and publishes on every push to `main`.
2. Project pages (`https://<user>.github.io/<repo>/`) need no configuration: the base path is derived
   from the repository name at build time.
3. Custom domain: add the domain under Settings → Pages, set the repository variable
   `SITE_URL=https://jordanfry.com`, and point DNS at GitHub Pages (apex A records
   185.199.108.153 / .109 / .110 / .111, `www` CNAME to `<user>.github.io`). Enforce HTTPS once issued.

## The hero

Warm dust motes drift in a light shaft, coalesce into the headline, and from then on _are_ the
headline. The `<h1>` is real text in the HTML for readers, screen readers and search engines, but
while the hero runs it is never painted: a tiny inline probe keeps it invisible from first paint,
the motes drift for a beat, fly in and form the glyphs over about two seconds, and then settle into
one mote per device pixel of the type, each a flat linen dot with that pixel's own coverage, so the
resting name is the typeset headline pixel for pixel with nothing hidden underneath. Whatever moves a
pixel turns it back into dust until it drifts home: the pointer (or a finger swiped across the
name) blows letters off as it passes, a click or tap anywhere in the hero throws the whole name
outward and it re-forms in about two seconds, scrolling releases it into the shaft, and a few spare
grains lift off the letters now and then while idle. Without WebGL, or if the hero fails to start,
the headline simply shows. Quality tiers cap the name at 200k / 100k / 45k motes (a coarser cell is
used when the glyphs hold more device pixels than that) with 18k / 10k / 5k ambient motes, chosen
from the device and stepped down if frames run long. The whole site ignores the OS
reduced-motion flag on purpose (Windows reports it whenever "Show animations in Windows" is off, so
the hero, the section reveals and the self-drafting sheets would all be lost on such machines);
`?motion=static` turns every animation off and renders the shaft's dust as one still frame under the
typeset headline. Without WebGL the CSS light shaft and the headline are the designed state.

Debugging: `/?debug=hero` shows an on-screen readout of every decision the hero makes (GPU probe
verdict and renderer, tier, mount result, mirrored console errors such as shader failures) and overlays
the sampled glyph targets on the headline; `/?gl=software` allows software WebGL (used by the tests).
