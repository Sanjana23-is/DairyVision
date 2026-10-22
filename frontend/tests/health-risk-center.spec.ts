import { test, expect } from '@playwright/test';

test.describe('Herd Health & Risk Center E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Log in with demo credentials
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'demo.farmer@dairyvision.ai');
    await page.fill('input[type="password"]', 'DairyVisionDemo2026!');
    await page.click('button[type="submit"]');

    // 2. Wait for redirect
    await page.waitForURL((url) => url.pathname.includes('/dashboard') || url.pathname.includes('/select-farm'), {
      timeout: 10000,
    });

    if (page.url().includes('/select-farm')) {
      await page.click('button:has-text("Enter Farm")');
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    }
  });

  test('should display Herd Health & Risk Center with 5 dimensions, no technical jargon in primary UI, and grouped events', async ({ page }) => {
    page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message, err.stack));

    // Navigate to Health & Risk Center
    await page.goto('http://localhost:3000/health-alerts');
    await expect(page.locator('text=Herd Health & Risk Center')).toBeVisible({ timeout: 10000 });

    // Verify KPI filters are visible
    await expect(page.locator('text=Healthy Herd')).toBeVisible();
    await expect(page.locator('text=Monitor & Check')).toBeVisible();
    await expect(page.locator('text=Attention Needed')).toBeVisible();

    // Verify no raw DB field names in farmer-facing cards
    const cardContent = await page.textContent('body');
    expect(cardContent).not.toContain('milk_produced_liters:');
    expect(cardContent).not.toContain('expected_milk_yield: null');
    expect(cardContent).not.toContain('Isolation Forest Outlier');

    // Click on Healthy Herd filter
    await page.click('text=Healthy Herd');
    await page.waitForTimeout(300);

    // Click "View Cow" on the first available cow card
    const viewCowBtn = page.locator('button:has-text("View Cow")').first();
    await expect(viewCowBtn).toBeVisible({ timeout: 5000 });
    await viewCowBtn.click();

    // Verify Modal Header & Cow Details (Section A)
    await expect(page.locator('text=Recent Observations')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Distinct Events')).toBeVisible();
    await expect(page.locator('text=Active Cases')).toBeVisible();
    await expect(page.locator('text=Technical Signals')).toBeVisible();

    // Verify Section B: Why is this cow flagged?
    await expect(page.getByText('Why is this cow flagged?')).toBeVisible();
    await expect(page.getByText('Recorded Health')).toBeVisible();
    await expect(page.getByText('Milk Production', { exact: true })).toBeVisible();
    await expect(page.getByText('AI Monitoring')).toBeVisible();

    // Verify Section C: Recent Activity & Time Filters
    const sectionC = page.locator('[data-testid="section-recent-activity"]');
    await expect(page.locator('text=Recent Activity & Clinical Audit')).toBeVisible();
    await expect(sectionC.locator('button:has-text("7 Days")')).toBeVisible();
    await expect(sectionC.locator('button:has-text("3 Days")')).toBeVisible();
    await expect(sectionC.locator('button:has-text("30 Days")')).toBeVisible();
    await expect(sectionC.locator('button:has-text("All")')).toBeVisible();

    // Switch to 3 Days filter in Section C
    await sectionC.locator('button:has-text("3 Days")').click();
    await page.waitForTimeout(200);

    // Switch to All filter in Section C
    await sectionC.locator('button:has-text("All")').click();
    await page.waitForTimeout(200);

    // Verify Section D: Historical Production Evidence
    const sectionD = page.locator('[data-testid="section-production-evidence"]');
    await expect(page.locator('text=Historical Production Evidence')).toBeVisible();

    // Verify measurement label requirement
    await expect(page.locator('text=Total milk produced per day (litres)').first()).toBeVisible();
    await expect(page.locator('text=Actual Recorded Daily Log').first()).toBeVisible();

    // Verify Leakage Prevention Guarantee
    await expect(page.locator('text=Baseline is calculated strictly from prior days, excluding the evaluated date.')).toBeVisible();

    // Verify Production KPI cards
    await expect(page.locator('text=Latest Recorded Yield')).toBeVisible();
    await expect(page.locator('text=Cow\'s Usual Baseline')).toBeVisible();
    await expect(page.locator('text=Change vs Usual')).toBeVisible();

    // Verify Section D date range filter tabs
    await expect(sectionD.locator('button:has-text("7 Days")')).toBeVisible();
    await expect(sectionD.locator('button:has-text("14 Days")')).toBeVisible();
    await expect(sectionD.locator('button:has-text("30 Days")')).toBeVisible();
    await expect(sectionD.locator('button:has-text("All History")')).toBeVisible();

    // Click 14 Days filter in Section D
    await sectionD.locator('button:has-text("14 Days")').click();
    await page.waitForTimeout(200);

    // Click 7 Days filter in Section D
    await sectionD.locator('button:has-text("7 Days")').click();
    await page.waitForTimeout(200);

    // Verify Section E: Tailored Management Recommendations
    await expect(page.locator('text=Tailored Management Recommendations')).toBeVisible();

    // Verify Section F: Technical Diagnostics Collapsed Accordion
    const technicalSummary = page.locator('summary:has-text("View Raw Diagnostic & Model Signals")');
    await expect(technicalSummary).toBeVisible();

    // Verify Section G: Cross-feature Links
    await expect(page.getByRole('link', { name: 'Cow Profile' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Digital Twin' })).toBeVisible();

    // Close modal
    await page.click('button:has-text("Close")');
    await expect(page.getByText('Why is this cow flagged?')).not.toBeVisible();
  });

  test('should verify Historical Production Evidence table, date filtering, and older history toggle', async ({ page }) => {
    // Navigate to Health & Risk Center
    await page.goto('http://localhost:3000/health-alerts');
    await expect(page.locator('text=Herd Health & Risk Center')).toBeVisible({ timeout: 10000 });

    // Click on Healthy Herd filter
    await page.click('text=Healthy Herd');
    await page.waitForTimeout(300);

    const viewBtn = page.locator('button:has-text("View Cow")').first();
    await viewBtn.click();

    // Verify modal opened
    const sectionD = page.locator('[data-testid="section-production-evidence"]');
    await expect(sectionD).toBeVisible({ timeout: 5000 });

    // Verify the label strictly states "Total milk produced per day (litres)"
    await expect(sectionD.locator('text=Total milk produced per day (litres)').first()).toBeVisible();

    // Verify Leakage Prevention note
    await expect(sectionD.locator('text=Baseline is calculated strictly from prior days, excluding the evaluated date.')).toBeVisible();

    // Verify date range filters are interactive
    await sectionD.locator('button:has-text("14 Days")').click();
    await page.waitForTimeout(200);

    await sectionD.locator('button:has-text("All History")').click();
    await page.waitForTimeout(200);

    await sectionD.locator('button:has-text("7 Days")').click();
    await page.waitForTimeout(200);

    // If inspect older history toggle is visible, test expanding and collapsing
    const inspectOlderBtn = sectionD.locator('button:has-text("Inspect older history")');
    if (await inspectOlderBtn.isVisible()) {
      await inspectOlderBtn.click();
      await page.waitForTimeout(200);
      await expect(sectionD.locator('button:has-text("Show latest only")')).toBeVisible();
      await sectionD.locator('button:has-text("Show latest only")').click();
    }

    // Close modal
    await page.click('button:has-text("Close")');
    await expect(sectionD).not.toBeVisible();
  });
});
