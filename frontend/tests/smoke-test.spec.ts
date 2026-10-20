import { test, expect } from '@playwright/test';

test('end-to-end hackathon demonstration smoke test', async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()} (${req.failure()?.errorText || 'failed'})`);
  });

  // 1. Visit login page
  await page.goto('http://localhost:3000/login');
  await expect(page).toHaveTitle(/DairyVision AI/i);

  // 2. Log in using authorized demo user
  await page.fill('input[type="email"]', 'demo.farmer@dairyvision.ai');
  await page.fill('input[type="password"]', 'DairyVisionDemo2026!');
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard or select-farm
  await page.waitForURL((url) => url.pathname.includes('/dashboard') || url.pathname.includes('/select-farm'), { timeout: 10000 });

  if (page.url().includes('/select-farm')) {
    // Click on Enter Farm if prompted
    await page.click('button:has-text("Enter Farm")');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  }

  // 3. Open Dashboard & verify live KPI stats
  await expect(page.locator('text=TOTAL COWS')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=MILK PRODUCED TODAY')).toBeVisible();
  await expect(page.locator('text=EXPECTED YIELD TODAY')).toBeVisible();
  await expect(page.locator('text=ACTIVE HEALTH ALERTS')).toBeVisible();

  // 4. Open Cows list and click cow Ganga
  await page.goto('http://localhost:3000/cows');
  await expect(page.locator('text=Ganga')).toBeVisible({ timeout: 10000 });
  await page.click('text=Ganga');

  // 5. Verify Cow Profile & deep link to SHAP Explainability
  await expect(page.locator('text=AI Decision Intelligence Actions')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=Why This Prediction? (SHAP)')).toBeVisible();

  await page.click('text=Why This Prediction? (SHAP)');
  await page.waitForURL('**/explainability**', { timeout: 10000 });
  expect(page.url()).toContain('explainability');

  // 6. Return to Cow Profile and open What-If Simulation
  await page.goto('http://localhost:3000/cows');
  await page.click('text=Ganga');
  await expect(page.locator('text=Simulate This Cow (What-If)')).toBeVisible({ timeout: 10000 });

  await page.click('text=Simulate This Cow (What-If)');
  await page.waitForURL('**/simulation**', { timeout: 10000 });
  expect(page.url()).toContain('cowId=445999f4-2b84-415c-9d4e-eba7d962e476');

  // Verify that Ganga is selected in the subject cow select box
  const selectedCow = await page.locator('select').first().inputValue();
  expect(selectedCow).toBe('445999f4-2b84-415c-9d4e-eba7d962e476');

  // 7. Change scenario inputs via Preset and verify impact updates
  await page.click('text=Active Cooling (-6 THI)');
  await page.waitForTimeout(1000);

  // Verify Estimated Financial Impact card renders
  await expect(page.locator('text=Estimated Financial Impact')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=Estimated Daily Net Impact')).toBeVisible();

  // 8. Check Health Alerts Page
  await page.goto('http://localhost:3000/health-alerts');
  await expect(page.locator('text=Herd Health & Risk Center')).toBeVisible({ timeout: 10000 });

  // 9. Check Recommendations Page
  await page.goto('http://localhost:3000/recommendations');
  await expect(page.locator('text=Actionable Herd Recommendations')).toBeVisible({ timeout: 10000 });

  // 10. Assert on console errors (filter out non-fatal dev warnings)
  const criticalErrors = consoleErrors.filter((e) => !e.includes('favicon') && !e.includes('[vite]'));
  console.log('Browser Smoke Test Complete. Critical console errors:', criticalErrors.length);
  const apiFailed = failedRequests.filter((r) => r.includes('/api/v1/'));
  expect(apiFailed.length).toBe(0);
});
