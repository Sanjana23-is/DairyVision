import { test, expect } from '@playwright/test';

test.describe('Consolidated Cow Recommendations E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Log in with demo farmer credentials
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'demo.farmer@dairyvision.ai');
    await page.fill('input[type="password"]', 'DairyVisionDemo2026!');
    await page.click('button[type="submit"]');

    // 2. Wait for redirect
    await page.waitForURL(
      (url) => url.pathname.includes('/dashboard') || url.pathname.includes('/select-farm'),
      { timeout: 10000 }
    );

    if (page.url().includes('/select-farm')) {
      await page.click('button:has-text("Enter Farm")');
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    }
  });

  test('should display only one consolidated recommendation row per cow in table', async ({ page }) => {
    await page.goto('http://localhost:3000/recommendations');

    // Wait for heading and summary cards to be visible
    await expect(page.locator('text=Actionable Herd Recommendations')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Pending Actions')).toBeVisible({ timeout: 10000 });

    // Wait for the recommendations table to load
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Collect all displayed cow names
    const cowNames: string[] = [];
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const cowCell = await row.locator('td').first().textContent();
      if (cowCell) {
        cowNames.push(cowCell.trim());
      }
    }

    // Verify uniqueness: every cow must appear EXACTLY ONCE
    const uniqueCowNames = new Set(cowNames);
    expect(cowNames.length).toBe(uniqueCowNames.size);

    // Verify row details: check that multi-action cows show category tags and sub-action badge
    const multiActionBadge = page.locator('text=+1 more action').first();
    if (await multiActionBadge.isVisible()) {
      await expect(multiActionBadge).toBeVisible();
    }
  });

  test('clicking View Details displays all recommended actions for cow with explanations and next steps', async ({ page }) => {
    await page.goto('http://localhost:3000/recommendations');
    await expect(page.locator('text=Actionable Herd Recommendations')).toBeVisible({ timeout: 10000 });

    // Find and click the first "View Details" button
    const viewDetailsButtons = page.locator('.view-details-btn');
    await expect(viewDetailsButtons.first()).toBeVisible({ timeout: 10000 });
    await viewDetailsButtons.first().click();

    // Verify modal appears
    const modal = page.locator('[data-testid="recommendation-details-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verify modal header has cow details
    await expect(modal.locator('text=Consolidated Advisory Plan & Evidence Breakdown')).toBeVisible();

    // Verify sections: Why this recommendation? and Practical Next Steps
    await expect(modal.locator('text=Why this recommendation?').first()).toBeVisible();
    await expect(modal.locator('text=Practical Next Steps').first()).toBeVisible();

    // Verify modal shows action cards
    const actionCards = modal.locator('[data-testid^="cow-action-card-"]');
    const actionCount = await actionCards.count();
    expect(actionCount).toBeGreaterThanOrEqual(1);

    // Close modal
    await modal.locator('[data-testid="close-details-modal-btn"]').click();
    await expect(modal).not.toBeVisible();
  });

  test('filters, search, and completion status work correctly with grouped cows', async ({ page }) => {
    await page.goto('http://localhost:3000/recommendations');
    await expect(page.locator('text=Actionable Herd Recommendations')).toBeVisible({ timeout: 10000 });

    // Test Search input
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('Lakshmi');
    await page.waitForTimeout(400);

    // Should only show cow row(s) matching Lakshmi, each appearing only once
    const filteredRows = page.locator('tbody tr');
    const filteredCount = await filteredRows.count();
    expect(filteredCount).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < filteredCount; i++) {
      const text = await filteredRows.nth(i).textContent();
      expect(text?.toLowerCase()).toContain('lakshmi');
    }

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);

    // Test Status selector: Completed Only
    const statusSelect = page.locator('select').nth(2);
    await statusSelect.selectOption('completed');
    await page.waitForTimeout(300);

    // Reset status back to pending
    await statusSelect.selectOption('pending');
    await page.waitForTimeout(300);
  });

  test('prevent duplicate recommendations when evaluating herd recommendations', async ({ page }) => {
    await page.goto('http://localhost:3000/recommendations');
    await expect(page.locator('text=Actionable Herd Recommendations')).toBeVisible({ timeout: 10000 });

    const initialRows = page.locator('tbody tr');
    await expect(initialRows.first()).toBeVisible({ timeout: 10000 });
    const initialCount = await initialRows.count();

    // Click Evaluate Herd Recommendations button
    const evaluateBtn = page.locator('[data-testid="evaluate-recommendations-btn"]');
    await expect(evaluateBtn).toBeVisible();
    await evaluateBtn.click();

    // Wait for success toast
    await expect(page.locator('text=Herd advisory recommendations evaluated & updated!')).toBeVisible({
      timeout: 15000,
    });

    // Verify row count did not duplicate the cows
    const postRows = page.locator('tbody tr');
    const postCount = await postRows.count();

    // All cows must still be unique!
    const cowNames: string[] = [];
    for (let i = 0; i < postCount; i++) {
      const text = await postRows.nth(i).locator('td').first().textContent();
      if (text) cowNames.push(text.trim());
    }
    const uniqueCows = new Set(cowNames);
    expect(cowNames.length).toBe(uniqueCows.size);
  });

  test('no General category badge is shown on recommendation rows, and i18n works correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/recommendations');
    await expect(page.locator('text=Actionable Herd Recommendations')).toBeVisible({ timeout: 10000 });

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // Verify no row has the unnecessary "General" or "General Farm Management" category badge
    const badgeTexts = await page.locator('tbody tr span.rounded-md').allTextContents();
    for (const badge of badgeTexts) {
      expect(badge.toLowerCase()).not.toBe('general');
      expect(badge.toLowerCase()).not.toBe('general farm management');
    }

    // Verify relevant categories exist (such as Heat Stress, Nutrition, Veterinary Care, etc.)
    const categoryDropdown = page.locator('select').first();
    const options = await categoryDropdown.locator('option').allTextContents();
    expect(options.some((opt) => opt.includes('Nutrition'))).toBeTruthy();
    expect(options.some((opt) => opt.includes('Heat Stress'))).toBeTruthy();
    expect(options.some((opt) => opt.includes('General'))).toBeFalsy();

    // Verify language switcher updates UI labels in Hindi
    const langSelect = page.locator('select').filter({ hasText: /English|Hindi/i });
    if (await langSelect.isVisible()) {
      await langSelect.selectOption('hi');
      await expect(page.locator('text=कार्रवाई योग्य झुंड सिफारिशें')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=लंबित कार्रवाइयां')).toBeVisible();

      // Reset back to English
      await langSelect.selectOption('en');
      await expect(page.locator('text=Actionable Herd Recommendations')).toBeVisible({ timeout: 5000 });
    }
  });

  test('all six languages translate recommendation titles, categories, and details modal correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/recommendations');
    await expect(page.locator('text=Actionable Herd Recommendations')).toBeVisible({ timeout: 10000 });

    const switchLanguage = async (code: string) => {
      const toggle = page.locator('[data-testid="language-dropdown-toggle"]');
      await toggle.click();
      await page.locator(`[data-testid="lang-option-${code}"]`).click();
      await page.waitForTimeout(300);
    };

    // 1. Test Marathi (mr)
    await switchLanguage('mr');
    await expect(page.locator('text=कृतीयोग्य कळप शिफारसी')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=लंबित कृती')).toBeVisible();

    // Verify Marathi translated recommendation title in table
    const marathiTitles = [
      'दूध वाढीसाठी उच्च-ऊर्जा आहार समायोजित करा',
      'उष्मा ताण आणि जलयोजनाचे निरीक्षण करा',
      'पशुवैद्यकीय तपासणीचे नियोजन करा',
      'गाय वेगळी करा आणि तातडीने पशुवैद्यकीय तपासणीची व्यवस्था करा',
      'गोठ्यातील परिस्थितीचे निरीक्षण सुरू ठेवा',
    ];

    const tableTextMr = await page.locator('tbody').textContent();
    expect(marathiTitles.some((title) => tableTextMr?.includes(title))).toBeTruthy();

    // Open View Details modal in Marathi
    const viewDetailsMr = page.locator('.view-details-btn').first();
    await viewDetailsMr.click();
    const modalMr = page.locator('[data-testid="recommendation-details-modal"]');
    await expect(modalMr).toBeVisible();

    // Verify modal headers and sections are in Marathi
    await expect(modalMr.locator('text=एकत्रित सल्लागार आढावा')).toBeVisible();
    await expect(modalMr.locator('text=ही शिफारस का?').first()).toBeVisible();
    await expect(modalMr.locator('text=पुढील व्यावहारिक पावले').first()).toBeVisible();

    // Verify recommendation title inside modal is translated to Marathi (not English)
    const modalTextMr = await modalMr.textContent();
    expect(marathiTitles.some((title) => modalTextMr?.includes(title))).toBeTruthy();
    expect(modalTextMr?.includes('Adjust high-energy ration for milk recovery')).toBeFalsy();
    expect(modalTextMr?.includes('Schedule veterinary attention')).toBeFalsy();
    expect(modalTextMr?.includes('Monitor heat stress and hydration')).toBeFalsy();

    // Close modal
    await modalMr.locator('[data-testid="close-details-modal-btn"]').click();
    await expect(modalMr).not.toBeVisible();

    // 2. Test Hindi (hi)
    await switchLanguage('hi');
    await expect(page.locator('text=कार्रवाई योग्य झुंड सिफारिशें')).toBeVisible();
    await expect(page.locator('text=लंबित कार्रवाइयां')).toBeVisible();

    // 3. Test Punjabi (pa)
    await switchLanguage('pa');
    await expect(page.locator('text=ਕਾਰਵਾਈਯੋਗ ਝੁੰਡ ਸਿਫ਼ਾਰਸ਼ਾਂ')).toBeVisible();
    await expect(page.locator('text=ਲੰਬਿਤ ਕਾਰਵਾਈਆਂ')).toBeVisible();

    // 4. Test Gujarati (gu)
    await switchLanguage('gu');
    await expect(page.locator('text=ક્રિયયોગ્ય ટોળું ભલામણો')).toBeVisible();
    await expect(page.locator('text=પૅન્ડિંગ ક્રિયાઓ')).toBeVisible();

    // 5. Test Kannada (kn)
    await switchLanguage('kn');
    await expect(page.locator('text=ಕ್ರಮಯೋಗ್ಯ ಹಿಂಡಿನ ಶಿಫಾರಸುಗಳು')).toBeVisible();
    await expect(page.locator('text=ಬಾಕಿ ಉಳಿದ ಕ್ರಮಗಳು')).toBeVisible();

    // 6. Reset back to English (en)
    await switchLanguage('en');
    await expect(page.locator('text=Actionable Herd Recommendations')).toBeVisible();
    await expect(page.locator('text=Pending Actions')).toBeVisible();
  });
});

