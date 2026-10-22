import { test, expect } from '@playwright/test';

test.describe('Prediction Page Empty-State and Baseline Behavior Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Log in as demo farmer
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'demo.farmer@dairyvision.ai');
    await page.fill('input[type="password"]', 'DairyVisionDemo2026!');
    await page.click('button[type="submit"]');

    await page.waitForURL(
      (url) => url.pathname.includes('/dashboard') || url.pathname.includes('/select-farm'),
      { timeout: 10000 },
    );
    if (page.url().includes('/select-farm')) {
      await page.click('button:has-text("Enter Farm")');
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    }

    // 2. Navigate to Prediction Page
    await page.goto('http://localhost:3000/predictions');
    if (page.url().includes('/select-farm')) {
      await page.click('button:has-text("Enter Farm")');
      await page.waitForURL('**/predictions', { timeout: 10000 });
    }
    await expect(page.locator('[data-testid="cow-selector"]')).toBeVisible({ timeout: 10000 });
  });

  test('when no cow is selected, helpful empty state is shown and all prediction numbers are hidden', async ({ page }) => {
    // The "no-cow-selected-state" banner should be visible
    const emptyState = page.locator('[data-testid="no-cow-selected-state"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No Cow Selected');
    await expect(emptyState).toContainText('Please select a cow from your herd');

    // No numerical prediction, baseline tiles, or "Why This Prediction?" should be displayed
    await expect(page.locator('text=EXPECTED DAILY BASELINE')).not.toBeVisible();
    await expect(page.locator('text=RECORDED ACTUAL YIELD')).not.toBeVisible();
    await expect(page.locator('text=ANOMALY STATUS')).not.toBeVisible();
    await expect(page.locator('text=Why This Prediction?')).not.toBeVisible();
    await expect(page.locator('text=Baseline Methodology')).not.toBeVisible();

    // Cow selector defaults to "Select a cow..."
    const cowSelector = page.locator('[data-testid="cow-selector"]');
    await expect(cowSelector).toHaveValue('');

    // Generate Prediction button should be disabled
    const generateBtn = page.locator('[data-testid="generate-prediction-button"]');
    await expect(generateBtn).toBeDisabled();
  });

  test('when a cow with zero observations is selected, clear empty state is shown without fabricated values', async ({ page }) => {
    // 1. Create cow "Shanti" with 0 observations
    await page.goto('http://localhost:3000/cows');
    await page.locator('[data-testid="add-cow-button"]').click();
    const nameInput = page.locator('[data-testid="add-cow-name"]');
    await nameInput.fill('Shanti');
    const tagInput = page.locator('[data-testid="add-cow-tag"], input[name="tag"]').first();
    await tagInput.fill(`SHANTI-${Date.now()}`);
    await page.click('[data-testid="add-cow-submit"]');
    await page.waitForTimeout(1000);

    // 2. Navigate back to Predictions page
    await page.goto('http://localhost:3000/predictions');
    const cowSelector = page.locator('[data-testid="cow-selector"]');
    await expect(cowSelector).toBeVisible({ timeout: 10000 });

    // Select cow "Shanti" (who has 0 observations)
    await cowSelector.selectOption({ label: '🐄 Shanti' });

    // The "no-historical-observations-state" should be visible
    const noObsState = page.locator('[data-testid="no-historical-observations-state"]');
    await expect(noObsState).toBeVisible();
    await expect(noObsState).toContainText('No Historical Observations for Shanti');
    await expect(noObsState).toContainText('no valid historical milk observations recorded yet');

    // No numerical baseline or prediction cards should exist
    await expect(page.locator('text=EXPECTED DAILY BASELINE')).not.toBeVisible();
    await expect(page.locator('text=RECORDED ACTUAL YIELD')).not.toBeVisible();
    await expect(page.locator('text=Why This Prediction?')).not.toBeVisible();

    // Must not interpret missing observation as 0.00 L
    await expect(page.locator('text=0.00 L')).not.toBeVisible();

    // CTA to log observation should be visible
    const logCta = page.locator('a:has-text("Log Daily Observation")');
    await expect(logCta).toBeVisible();
  });

  test('selecting a cow with observations loads observation context and generates prediction', async ({ page }) => {
    const cowSelector = page.locator('[data-testid="cow-selector"]');

    // Select cow "Ganga" (who has valid observation history)
    await cowSelector.selectOption({ label: '🐄 Ganga' });

    // Observation trigger should now display Ganga
    const obsTrigger = page.locator('[data-testid="observation-selector-trigger"]');
    await expect(obsTrigger).toContainText('Ganga');

    // Generate Prediction button should be enabled
    const generateBtn = page.locator('[data-testid="generate-prediction-button"]');
    await expect(generateBtn).toBeEnabled();

    // Click Generate Prediction
    await generateBtn.click();

    // Hero tiles should now appear
    await expect(page.locator('text=EXPECTED DAILY BASELINE')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=RECORDED ACTUAL YIELD')).toBeVisible();
    await expect(page.locator('text=ANOMALY STATUS')).toBeVisible();

    // Verify baseline methodology strip
    await expect(page.locator('text=Baseline Methodology')).toBeVisible();

    // "Why This Prediction?" should be visible and not show default generic fallback
    await expect(page.locator('text=Why This Prediction?')).toBeVisible();
    await expect(page.locator('text=TreeSHAP analysis based on biometric and weather data.')).toBeVisible();
  });

  test('switching from a selected cow back to unselected restores the no-cow empty state', async ({ page }) => {
    const cowSelector = page.locator('[data-testid="cow-selector"]');

    // 1. Select Ganga
    await cowSelector.selectOption({ label: '🐄 Ganga' });
    await expect(page.locator('[data-testid="observation-selector-trigger"]')).toContainText('Ganga');

    // 2. Reset back to empty / "Select a cow..."
    await cowSelector.selectOption({ value: '' });

    // Empty state returns
    const emptyState = page.locator('[data-testid="no-cow-selected-state"]');
    await expect(emptyState).toBeVisible();
    await expect(page.locator('text=EXPECTED DAILY BASELINE')).not.toBeVisible();
    await expect(page.locator('text=Why This Prediction?')).not.toBeVisible();
  });
});
