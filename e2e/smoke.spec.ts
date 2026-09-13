import { test, expect } from '@playwright/test';

/** Page-side access to the hero's pixel probe (`?debug=hero` exposes the handle on `window.__hero`). */
type HeroWindow = Window & {
  __hero?: {
    probePoints(n?: number): [number, number][];
    samplePixel(x: number, y: number): [number, number, number, number];
  };
};
const brightnessAt = (page: import('@playwright/test').Page, x: number, y: number) =>
  page.evaluate(
    ([px, py]) => {
      const h = (window as HeroWindow).__hero;
      if (!h) return -1;
      const [r, g, b] = h.samplePixel(px, py);
      return Math.max(r, g, b);
    },
    [x, y] as const,
  );

test.describe('home', () => {
  test('headline paints first and the particle hero lights it up', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto('/?gl=software&debug=hero');
    const h1 = page.locator('#hero-name');
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText(/Jordan\s*Fry/);
    // The headline is hidden from first paint while the dust forms it. The pre-paint flag may
    // already have handed over to `.is-forming` by the time we look.
    await expect(h1).toHaveCSS('opacity', '0');
    await expect(page.locator('#hero-canvas')).toHaveClass(/(?:^|\s)is-live(?:\s|$)/, { timeout: 20_000 });
    await expect(page.locator('html')).not.toHaveAttribute('data-hero-intro', 'pending');
    await expect(page.locator('[data-hero]')).toHaveClass(/(?:^|\s)is-forming(?:\s|$)/);
    await expect(h1).toHaveCSS('opacity', '0');
    await expect(page.locator('[data-hero]')).toHaveClass(/(?:^|\s)is-lit(?:\s|$)/, { timeout: 30_000 });
    // From here on the dust is the name: the type stays unpainted and a pixel well inside a glyph
    // is linen in the drawing buffer.
    await expect(h1).toHaveCSS('opacity', '0');
    const points = await page.evaluate(() => (window as HeroWindow).__hero?.probePoints(3) ?? []);
    expect(points.length).toBeGreaterThan(0);
    const [x, y] = points[0]!;
    await expect.poll(() => brightnessAt(page, x, y), { timeout: 15_000 }).toBeGreaterThan(150);
    expect(errors).toEqual([]);
  });

  test('the name is dust: the pointer blows a pixel off its letter and a tap scatters it', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/?gl=software&debug=hero');
    const hero = page.locator('[data-hero]');
    await expect(hero).toHaveClass(/(?:^|\s)is-lit(?:\s|$)/, { timeout: 40_000 });
    const points = await page.evaluate(() => (window as HeroWindow).__hero?.probePoints(3) ?? []);
    expect(points.length).toBeGreaterThan(0);
    const [x, y] = points[0]!;
    await expect.poll(() => brightnessAt(page, x, y), { timeout: 15_000 }).toBeGreaterThan(150);
    if (!isMobile) {
      // A pointer arriving on that pixel pushes it away: the spot goes dark.
      await page.mouse.move(x - 60, y, { steps: 6 });
      await page.mouse.move(x, y, { steps: 6 });
      await expect.poll(() => brightnessAt(page, x, y), { timeout: 10_000 }).toBeLessThan(80);
      // Once the pointer has left and its trail has died down, the pixel is back. (The dust runs
      // partly on rendered time, which lags real time under software WebGL: hence the long waits.)
      await page.mouse.move(x + 900, y + 400, { steps: 6 });
      await expect.poll(() => brightnessAt(page, x, y), { timeout: 25_000 }).toBeGreaterThan(150);
    }
    // A tap scatters the name; it re-forms within a few seconds.
    if (isMobile) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    await expect.poll(() => brightnessAt(page, x, y), { timeout: 10_000 }).toBeLessThan(80);
    await expect.poll(() => brightnessAt(page, x, y), { timeout: 25_000 }).toBeGreaterThan(150);
    await expect(page.locator('#hero-name')).toHaveText(/Jordan\s*Fry/);
  });

  test('the OS reduced-motion flag does not stop the intro', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/?gl=software');
    await expect(page.locator('#hero-canvas')).toHaveClass(/(?:^|\s)is-live(?:\s|$)/, { timeout: 20_000 });
    await expect(page.locator('[data-hero]')).toHaveClass(/(?:^|\s)is-forming(?:\s|$)/);
    await expect(page.locator('#hero-canvas')).toHaveCSS('transition-duration', '0.6s');
    await expect(page.locator('[data-hero]')).toHaveClass(/(?:^|\s)is-lit(?:\s|$)/, { timeout: 30_000 });
    await ctx.close();
  });

  test('?motion=static renders the finished frame and keeps the headline at full opacity', async ({
    page,
  }) => {
    await page.goto('/?gl=software&motion=static');
    await expect(page.locator('#hero-canvas')).toHaveClass(/(?:^|\s)is-static(?:\s|$)/, { timeout: 20_000 });
    await expect(page.locator('[data-hero]')).not.toHaveClass(/(?:^|\s)is-lit(?:\s|$)/);
    await expect(page.locator('html')).not.toHaveAttribute('data-hero-intro', 'pending');
    await expect(page.locator('#hero-name')).toHaveCSS('opacity', '1');
  });

  test('without WebGL the headline is simply visible', async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      // @ts-expect-error simulate a browser with no WebGL2
      delete window.WebGL2RenderingContext;
    });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveAttribute('data-hero-intro', 'pending');
    await expect(page.locator('#hero-name')).toHaveCSS('opacity', '1');
    await page.waitForTimeout(1500);
    await expect(page.locator('#hero-canvas')).not.toHaveClass(/(?:^|\s)is-live(?:\s|$)/);
    await ctx.close();
  });

  test('sections, structured data and the services disclosure', async ({ page }) => {
    await page.goto('/');
    for (const [i, id] of ['work', 'services', 'about', 'testimonials', 'contact'].entries()) {
      const section = page.locator(`#${id}`);
      await expect(section).toBeAttached();
      // Every section opens with its index and a hairline rule.
      await expect(section.locator('.rule').first()).toBeAttached();
      await expect(section.locator(`#${id}-h`)).toBeAttached();
      await expect(section.getByText(String(i + 1).padStart(2, '0'), { exact: true }).first()).toBeAttached();
    }
    // Work cards carry a visible caption: index, title and type · town · year.
    const firstCard = page.locator('#work li a[href*="/work/"]').first();
    await expect(firstCard.locator('.card-meta')).toContainText(/01/);
    await expect(firstCard.locator('.card-meta')).toContainText(/·\s*\d{4}\s*$/);
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', /\/$/);
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
    expect(ld['@graph'][0]['@type']).toBe('GeneralContractor');
    const first = page.locator('#services details').first();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
  });

  test('contact form validates before sending', async ({ page }) => {
    await page.goto('/');
    const form = page.locator('#contact-form');
    test.skip((await form.count()) === 0, 'form is omitted without PUBLIC_WEB3FORMS_KEY');
    await form.locator('button[type=submit]').click();
    await expect(page.locator('#cf-name-err')).toBeVisible();
    await expect(page.locator('#cf-name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#cf-name')).toBeFocused();
  });
});

test.describe('work', () => {
  test('index lists projects; a project page opens a keyboard-operable lightbox', async ({ page }) => {
    await page.goto('/work/');
    const cards = page.locator('a[href*="/work/"]').filter({ has: page.locator('figure') });
    expect(await cards.count()).toBeGreaterThanOrEqual(6);
    await cards.first().click();
    await expect(page).toHaveURL(/\/work\/[a-z0-9-]+\/$/);
    await expect(page.locator('h1')).toBeVisible();
    const opener = page.locator('[data-lightbox-open="0"]');
    await opener.scrollIntoViewIfNeeded();
    await opener.click();
    const dialog = page.locator('#lightbox');
    await expect(dialog).toHaveAttribute('open', '');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#lightbox-status')).toHaveText(/Photo 2 of/);
    await expect(page.locator('#lightbox-count')).toHaveText(/^2 \/ \d+$/);
    await expect(page.locator('#lightbox-caption')).not.toBeEmpty();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toHaveAttribute('open', '');
    await expect(opener).toBeFocused();
  });

  test('covers are shown whole, at their own aspect, beside the title', async ({ page }) => {
    for (const id of ['cedar-deck-ligonier', 'fireplace-built-ins-greensburg']) {
      await page.goto(`/work/${id}/`);
      const img = page.locator('article figure img').first();
      await expect(img).toBeVisible();
      const r = await img.evaluate((el: HTMLImageElement) => ({
        natural: el.naturalWidth / el.naturalHeight,
        shown: el.clientWidth / el.clientHeight,
      }));
      expect(Math.abs(r.natural - r.shown)).toBeLessThan(0.02);
      await expect(page.locator('article h1')).toBeVisible();
    }
  });

  test('the OS reduced-motion flag does not pre-draw the sheets; ?motion=static does', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/work/');
    const last = page.locator('main ul li').last();
    await expect(last).not.toHaveClass(/is-in/);
    expect(
      await last
        .locator('svg.sheet .o')
        .first()
        .evaluate((el) => getComputedStyle(el).strokeDashoffset),
    ).toBe('1px');
    await page.goto('/work/?motion=static');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'static');
    await expect(page.locator('main ul li').last()).toHaveClass(/is-in/);
    expect(
      await page
        .locator('main ul li')
        .last()
        .locator('svg.sheet .o')
        .first()
        .evaluate((el) => getComputedStyle(el).strokeDashoffset),
    ).toBe('0px');
  });

  test('placeholder sheets are inlined and draft themselves on reveal', async ({ page }) => {
    await page.goto('/work/');
    const last = page.locator('main ul li').last();
    const sheet = last.locator('svg.sheet');
    await expect(sheet).toBeAttached();
    await expect(sheet).toHaveAttribute('style', /--n:\d+/);
    const before = await sheet
      .locator('.o')
      .first()
      .evaluate((el) => getComputedStyle(el).strokeDashoffset);
    expect(before).toBe('1px');
    await last.scrollIntoViewIfNeeded();
    await expect(last).toHaveClass(/is-in/);
    await expect
      .poll(
        () =>
          sheet
            .locator('.o')
            .first()
            .evaluate((el) => getComputedStyle(el).strokeDashoffset),
        {
          timeout: 5000,
        },
      )
      .toBe('0px');
    await expect(sheet.locator('.tb')).toHaveCSS('opacity', '1', { timeout: 5000 });
  });

  test('unknown routes get the 404 page', async ({ page }) => {
    const res = await page.goto('/nope/');
    expect(res?.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText(/Nothing here/);
  });
});

test.describe('mobile call bar', () => {
  test('is on screen only when no other primary action is', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/');
    const bar = page.locator('#callbar');
    await expect(bar).not.toHaveClass(/(?:^|\s)is-visible(?:\s|$)/);
    await page.evaluate(() => window.scrollTo(0, 1600));
    await expect(bar).toHaveClass(/(?:^|\s)is-visible(?:\s|$)/);
    await page.evaluate(() => document.querySelector('#contact dl')?.scrollIntoView({ block: 'center' }));
    await expect(bar).not.toHaveClass(/(?:^|\s)is-visible(?:\s|$)/);
  });
});
