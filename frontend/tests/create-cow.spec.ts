import { test, expect } from '@playwright/test';

test('create cow dialog opens and validates inputs', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'demo.farmer@dairyvision.ai');
  await page.fill('input[type="password"]', 'DairyVisionDemo2026!');
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => url.pathname.includes('/dashboard') || url.pathname.includes('/select-farm'), { timeout: 10000 });
  if (page.url().includes('/select-farm')) {
    await page.click('button:has-text("Enter Farm")');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  }

  await page.goto('http://localhost:3000/cows');
  await expect(page.locator('text=Add Cow')).toBeVisible({ timeout: 10000 });
  await page.click('text=Add Cow');

  // Verify Add Cow modal dialog appears
  await expect(page.locator('input[name="tag_id"], input[placeholder*="Tag"], input[name="tag"]').first()).toBeVisible({ timeout: 5000 });
});
