import { test, expect } from '@playwright/test';

test.describe('home', () => {
  test('headline paints first and the particle hero lights it up', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto('/?gl=software');
    const h1 = page.locator('#hero-name');
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText(/Jordan\s*Fry/);
    // The headline is hidden from first paint while the dust forms it, then shown in full. The
    // pre-paint flag may already have handed over to `.is-forming` by the time we look.
    await expect(h1).toHaveCSS('opacity', '0');
    await expect(page.locator('#hero-canvas')).toHaveClass(/(?:^|\s)is-live(?:\s|$)/, { timeout: 20_000 });
    await expect(page.locator('html')).not.toHaveAttribute('data-hero-intro', 'pending');
    await expect(page.locator('[data-hero]')).toHaveClass(/(?:^|\s)is-forming(?:\s|$)/);
    await expect(h1).toHaveCSS('opacity', '0');
    await expect(page.locator('[data-hero]')).toHaveClass(/(?:^|\s)is-lit(?:\s|$)/, { timeout: 30_000 });
    await expect(h1).toHaveCSS('opacity', '1', { timeout: 5_000 });
    expect(errors).toEqual([]);
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
