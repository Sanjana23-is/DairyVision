import { test, expect } from '@playwright/test';

test('verify global layout and scrolling across all main routes', async ({ page }) => {
  // 1. Log in with demo credentials
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'demo.farmer@dairyvision.ai');
  await page.fill('input[type="password"]', 'DairyVisionDemo2026!');
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => url.pathname.includes('/dashboard') || url.pathname.includes('/select-farm'), {
    timeout: 15000,
  });

  if (page.url().includes('/select-farm')) {
    await page.click('button:has-text("Enter Farm")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  }

  const routes = [
    '/dashboard',
    '/cows',
    '/observations',
    '/predictions',
    '/health-alerts',
    '/recommendations',
    '/digital-twin',
    '/simulation',
    '/explainability',
    '/profile',
  ];

  const viewports = [
    { width: 1440, height: 900, name: 'large desktop' },
    { width: 1280, height: 720, name: 'standard desktop' },
    { width: 1024, height: 768, name: 'small desktop/tablet landscape' },
    { width: 768, height: 1024, name: 'tablet portrait' },
    { width: 390, height: 844, name: 'mobile' },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const route of routes) {
      await page.goto(`http://localhost:3000${route}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(300);

      const check = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const aside = document.querySelector('aside:not(.md\\:hidden)');
        const header = document.querySelector('header');
        const main = document.querySelector('main');

        return {
          windowWidth: window.innerWidth,
          docScrollWidth: docEl.scrollWidth,
          bodyScrollWidth: body.scrollWidth,
          hasHorizontalWindowOverflow: docEl.scrollWidth > window.innerWidth || body.scrollWidth > window.innerWidth,
          asideRect: aside ? aside.getBoundingClientRect() : null,
          headerRect: header ? header.getBoundingClientRect() : null,
          mainRect: main ? main.getBoundingClientRect() : null,
        };
      });

      if (check.hasHorizontalWindowOverflow) {
        console.error(
          `HORIZONTAL OVERFLOW on ${route} at ${vp.name} (${vp.width}x${vp.height}): docScrollWidth=${check.docScrollWidth}, windowWidth=${check.windowWidth}`
        );
      }
      expect(
        check.hasHorizontalWindowOverflow,
        `Page ${route} should not have window horizontal overflow at ${vp.name} (${vp.width}px)`
      ).toBe(false);

      // Verify vertical scrolling behavior
      await page.evaluate(() => window.scrollTo(0, 400));
      await page.waitForTimeout(100);

      const scrollCheck = await page.evaluate(() => {
        const header = document.querySelector('header');
        const aside = document.querySelector('aside:not(.md\\:hidden)');
        return {
          scrollY: window.scrollY,
          headerTop: header ? header.getBoundingClientRect().top : null,
          asideTop: aside ? aside.getBoundingClientRect().top : null,
        };
      });

      if (scrollCheck.scrollY > 0) {
        if (scrollCheck.headerTop !== null) {
          // Sticky header should stay at top: 0
          expect(Math.round(scrollCheck.headerTop)).toBe(0);
        }
        if (scrollCheck.asideTop !== null) {
          // Fixed sidebar should stay at top: 0
          expect(Math.round(scrollCheck.asideTop)).toBe(0);
        }
      }

      // Reset scroll
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  }
});
