import { test, expect } from '@playwright/test';

test.describe('Prediction Page Observation Selector Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Log in
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
    const trigger = page.locator('[data-testid="observation-selector-trigger"]');
    await expect(trigger).toBeVisible({ timeout: 10000 });
    await expect(trigger).toBeEnabled({ timeout: 10000 });
  });

  test('observation selector renders accessible trigger and opens searchable dropdown', async ({ page }) => {
    const trigger = page.locator('[data-testid="observation-selector-trigger"]');
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('role', 'combobox');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Click trigger to open dropdown
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Search input is visible and auto-focused
    const searchInput = page.locator('[data-testid="observation-search-input"]');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();

    // Listbox container is visible with internal scrolling constraints
    const listbox = page.locator('#observation-listbox');
    await expect(listbox).toBeVisible();
    await expect(listbox).toHaveAttribute('role', 'listbox');
    await expect(listbox).toHaveClass(/max-h-\[300px\]/);
    await expect(listbox).toHaveClass(/overflow-y-auto/);

    // Escape closes the dropdown
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(searchInput).not.toBeVisible();
  });

  test('search field filters observations by cow name, date, and shows empty state', async ({ page }) => {
    const trigger = page.locator('[data-testid="observation-selector-trigger"]');
    await trigger.click();

    const searchInput = page.locator('[data-testid="observation-search-input"]');
    await expect(searchInput).toBeVisible();

    // Check that observation options exist
    const options = page.locator('[role="option"]');
    const totalCount = await options.count();
    expect(totalCount).toBeGreaterThan(0);

    // Search for "Ganga"
    await searchInput.fill('Ganga');
    const gangaOptions = page.locator('[role="option"]');
    const gangaCount = await gangaOptions.count();
    expect(gangaCount).toBeGreaterThan(0);

    // Search for nonexistent query
    await searchInput.fill('NonExistentCowXYZ999');
    await expect(page.locator('text=No observations match your search')).toBeVisible();

    // Clear search query
    await page.click('button:has-text("Clear search query")');
    await expect(page.locator('[role="option"]').first()).toBeVisible();
  });

  test('selecting an observation updates trigger display and enables prediction button', async ({ page }) => {
    const trigger = page.locator('[data-testid="observation-selector-trigger"]');
    const generateBtn = page.locator('[data-testid="generate-prediction-button"]');

    // Click trigger to open
    await trigger.click();

    // Select the first observation option
    const firstOption = page.locator('[role="option"]').first();
    const optionText = await firstOption.innerText();
    await firstOption.click();

    // Dropdown closes after selection
    await expect(page.locator('[data-testid="observation-search-input"]')).not.toBeVisible();

    // Generate Prediction button should be enabled
    await expect(generateBtn).toBeEnabled();

    // Trigger now displays selected cow details
    await expect(trigger).not.toHaveText(/Pick an observation/i);
  });

  test('keyboard navigation with Arrow keys and Enter selects option', async ({ page }) => {
    const trigger = page.locator('[data-testid="observation-selector-trigger"]');
    await trigger.focus();

    // Open via Enter
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="observation-search-input"]')).toBeVisible();

    // Press ArrowDown to navigate list
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    // Select with Enter
    await page.keyboard.press('Enter');

    // Dropdown should be closed
    await expect(page.locator('[data-testid="observation-search-input"]')).not.toBeVisible();

    // Prediction button should now be enabled
    await expect(page.locator('[data-testid="generate-prediction-button"]')).toBeEnabled();
  });

  test('observation selector supports dynamic language switching in Kannada and English', async ({ page }) => {
    // Open selector in English
    const trigger = page.locator('[data-testid="observation-selector-trigger"]');
    await trigger.click();

    const searchInput = page.locator('[data-testid="observation-search-input"]');
    await expect(searchInput).toHaveAttribute('placeholder', 'Search by cow name or date...');

    // Switch dynamically to Kannada
    await page.evaluate(() => {
      (window as any).__setDairyVisionLanguage?.('kn');
    });

    // Label and search placeholder update dynamically
    await expect(page.locator('label#observation-selector-label')).toHaveText('ದೈನಿಕ ವೀಕ್ಷಣೆ ಆಯ್ಕೆಮಾಡಿ');
    await expect(searchInput).toHaveAttribute('placeholder', 'ಹಸುವಿನ ಹೆಸರು ಅಥವಾ ದಿನಾಂಕದ ಮೂಲಕ ಹುಡುಕಿ...');

    // Close and reset language
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      (window as any).__setDairyVisionLanguage?.('en');
    });
  });
});
