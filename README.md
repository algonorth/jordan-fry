# Jordan Fry — carpenter and contractor

A static site: Astro 7, Tailwind CSS 4, three.js. No backend. Deploys to GitHub Pages from `main`.

```bash
npm run dev        # http://localhost:4321
npm run build      # type check + static build into dist/
npm run preview    # serve dist/
npm test           # Playwright smoke tests against dist/ (run `npm run build` first)
npm run format     # Prettier
npm run placeholders   # regenerate the wood-grain placeholder images
npm run og         # regenerate public/og.png with the real fonts
```

## Where things live

| What                                                                 | Where                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Business facts (phone, email, area, hours, HIC number)               | `src/data/site.ts`                                                                               |
| Copy (hero line, about, process, contact, form, footer, page titles) | `src/data/copy.ts`                                                                               |
| Services and testimonials                                            | `src/data/services.ts`, `src/data/testimonials.ts`                                               |
| Projects                                                             | `src/content/work/<slug>/index.md` with its photos beside it                                     |
| Portrait                                                             | `src/assets/portrait.svg` (replace with a 1200×1500 JPEG and update the import in `About.astro`) |
| Design tokens and recipes                                            | `DESIGN.md`, `src/styles/global.css`                                                             |
| Particle hero                                                        | `src/lib/hero/` (loaded lazily by `HeroCanvas.astro`)                                            |

Every placeholder that needs real data contains the literal `TODO:`:

```bash
grep -rn "TODO" src scripts --include=*.ts --include=*.md --include=*.mjs
```

## Replacing placeholder photos

Drop JPEGs next to each project's `index.md` (long edge 1600 for covers and galleries, 2400 if a cover
should fill a large screen), point `cover:` / `gallery:` at them, write a real `alt`, and set
`placeholder: false`. Responsive `srcset` variants switch on automatically for raster images.

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

Warm dust motes drift in a light shaft, coalesce into the headline, part around the pointer, and
dissolve as the page scrolls. The `<h1>` is real text painted first (it is the LCP element); the
canvas is decorative and lazy-loaded after the page is idle. Quality tiers (60k / 24k / 8k motes) are
picked from the device and stepped down if frames run long. `prefers-reduced-motion` renders one still
frame. Without WebGL the CSS light shaft and the headline are the designed state.

Debugging: `/?debug=hero` overlays the sampled glyph targets on the headline; `/?gl=software` allows
software WebGL (used by the tests).
