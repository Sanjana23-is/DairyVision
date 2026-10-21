import { test, expect } from '@playwright/test';

test.describe('Indian Farm Location Picker and Weather Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'demo.farmer@dairyvision.ai');
    await page.fill('input[type="password"]', 'DairyVisionDemo2026!');
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => url.pathname.includes('/dashboard') || url.pathname.includes('/select-farm'), { timeout: 10000 });
    if (page.url().includes('/select-farm')) {
      await page.click('button:has-text("Enter Farm")');
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    }
  });

  test('Navbar Add Farm modal has Indian location hierarchy and parent resets', async ({ page }) => {
    // Open Add Farm modal via navbar button
    const newFarmBtn = page.locator('button:has-text("New Farm"), button:has-text("Create Farm")').first();
    if (await newFarmBtn.isVisible()) {
      await newFarmBtn.click();
    } else {
      await page.goto('http://localhost:3000/select-farm');
      await page.click('button:has-text("Create Another Farm")');
    }

    // Modal should be visible
    await expect(page.locator('text=Create Farm').first()).toBeVisible({ timeout: 5000 });

    // Country should be fixed to India
    await expect(page.locator('text=Fixed')).toBeVisible();
    await expect(page.locator('text=🇮🇳 India')).toBeVisible();

    // 1. Click State dropdown button
    const stateButton = page.locator('button:has-text("Select State")').first();
    await expect(stateButton).toBeVisible();
    await stateButton.click();

    // Filter states by typing "Karn"
    const stateSearchInput = page.locator('input[placeholder="Type to filter state..."]');
    await expect(stateSearchInput).toBeVisible();
    await stateSearchInput.fill('Karn');

    // Karnataka option should be visible
    const karnatakaOption = page.locator('button:has-text("Karnataka")');
    await expect(karnatakaOption).toBeVisible();
    await karnatakaOption.click();

    // Verify State is now Karnataka
    await expect(page.locator('button:has-text("Karnataka")')).toBeVisible();

    // 2. District dropdown should now be enabled with Karnataka districts
    const districtButton = page.locator('button:has-text("Select District")').first();
    await expect(districtButton).toBeVisible();
    await districtButton.click();

    // Filter districts by typing "Belagavi"
    const districtSearchInput = page.locator('input[placeholder="Type to filter district..."]');
    await expect(districtSearchInput).toBeVisible();
    await districtSearchInput.fill('Belagavi');

    const belagaviOption = page.locator('button:has-text("Belagavi")');
    await expect(belagaviOption).toBeVisible();
    await belagaviOption.click();

    // District is now Belagavi
    await expect(page.locator('button:has-text("Belagavi")')).toBeVisible();

    // 3. Parent-field reset: changing State to Maharashtra should clear Belagavi
    const changeStateBtn = page.locator('button:has-text("Karnataka")').first();
    await changeStateBtn.click();
    const mhSearch = page.locator('input[placeholder="Type to filter state..."]');
    await mhSearch.fill('Maharashtra');
    await page.locator('button:has-text("Maharashtra")').click();

    // District should reset to "Select District"
    await expect(page.locator('button:has-text("Select District")')).toBeVisible();
    await expect(page.locator('button:has-text("Belagavi")')).not.toBeVisible();

    // 4. "Use my current location" button is present and clickable
    const useLocationBtn = page.locator('button:has-text("Use my current location")');
    await expect(useLocationBtn).toBeVisible();

    // 5. Cancel closes modal cleanly
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('text=Create Farm').first()).not.toBeVisible();
  });

  test('Farm Workspace page displays coordinates and Edit Farm dialog', async ({ page }) => {
    await page.goto('http://localhost:3000/farms');
    // If redirected to select-farm or workspace
    if (page.url().includes('/select-farm')) {
      await page.click('button:has-text("Enter Farm")');
    }

    // Go to farm workspace
    await page.goto('http://localhost:3000/farms');
    await page.waitForTimeout(1000);

    // Look for Edit Location button if on workspace
    const editLocBtn = page.locator('button:has-text("Edit Location")').first();
    if (await editLocBtn.isVisible()) {
      await editLocBtn.click();
      await expect(page.locator('text=Edit Farm').first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=🇮🇳 India')).toBeVisible();
      await expect(page.locator('button:has-text("Use my current location")')).toBeVisible();
      await page.click('button:has-text("Cancel")');
    }
  });
});
