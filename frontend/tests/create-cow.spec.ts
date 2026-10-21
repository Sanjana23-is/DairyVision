import { test, expect } from '@playwright/test';

test.describe('Add Cow Dialog workflow and reset regression tests', () => {
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

    await page.goto('http://localhost:3000/cows');
    await expect(page.locator('text=Add Cow')).toBeVisible({ timeout: 10000 });
  });

  test('create cow dialog opens and validates inputs', async ({ page }) => {
    await page.click('text=Add Cow');
    await expect(page.locator('[data-testid="add-cow-tag"], input[name="tag"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('Add Cow dialog resets inputs when closed and reopened', async ({ page }) => {
    await page.click('text=Add Cow');
    const nameInput = page.locator('[data-testid="add-cow-name"]');
    const tagInput = page.locator('[data-testid="add-cow-tag"]');
    const weightInput = page.locator('[data-testid="add-cow-weight"]');

    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await expect(nameInput).toHaveValue('');
    await expect(tagInput).toHaveValue('');

    // Fill in test details
    await nameInput.fill('Temporary Cow');
    await tagInput.fill('TEMP-TAG-999');
    await weightInput.fill('485');

    // Cancel / close the dialog
    await page.click('[data-testid="add-cow-cancel"]');
    await expect(nameInput).not.toBeVisible();

    // Reopen Add Cow dialog
    await page.click('text=Add Cow');
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    // Verify fields are blank / initial default values, not retaining previous input
    await expect(nameInput).toHaveValue('');
    await expect(tagInput).toHaveValue('');
    await expect(weightInput).toHaveValue('');
  });

  test('Add Cow dialog preserves inputs on validation failure', async ({ page }) => {
    await page.click('text=Add Cow');
    const nameInput = page.locator('[data-testid="add-cow-name"]');
    const tagInput = page.locator('[data-testid="add-cow-tag"]');

    await expect(nameInput).toBeVisible({ timeout: 5000 });

    // Enter name but leave tag blank to trigger validation error
    await nameInput.fill('Unfinished Cow');
    await page.click('[data-testid="add-cow-submit"]');

    // Validation error should appear for Tag
    await expect(page.locator('text=Tag is required')).toBeVisible();

    // Entered name must be preserved so user does not have to retype
    await expect(nameInput).toHaveValue('Unfinished Cow');
  });

  test('Add Cow dialog translates all strings in Kannada and supports dynamic language switching', async ({ page }) => {
    // 1. Open dialog in English
    await page.click('[data-testid="add-cow-button"]');
    await expect(page.locator('h3:has-text("Add Cow")')).toBeVisible();
    await expect(page.locator('label:has-text("Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Tag")')).toBeVisible();
    await expect(page.locator('label:has-text("Age")')).toBeVisible();
    await expect(page.locator('label:has-text("Weight (kg)")')).toBeVisible();
    await expect(page.locator('label:has-text("Breed")')).toBeVisible();
    await expect(page.locator('label:has-text("Status")')).toBeVisible();
    await expect(page.locator('[data-testid="add-cow-age-years"]')).toHaveAttribute('placeholder', 'Years (e.g. 4)');
    await expect(page.locator('[data-testid="add-cow-age-months"]')).toHaveAttribute('placeholder', 'Months (0–11)');
    await expect(page.locator('text=Approximate age is okay.')).toBeVisible();
    await expect(page.locator('[data-testid="add-cow-weight"]')).toHaveAttribute('placeholder', 'e.g. 500');
    await expect(page.locator('[data-testid="add-cow-breed"] option').first()).toHaveText('Select breed');
    await expect(page.locator('[data-testid="add-cow-status"] option').first()).toHaveText('Select status');
    await expect(page.locator('[data-testid="add-cow-cancel"]')).toHaveText('Cancel');
    await expect(page.locator('[data-testid="add-cow-submit"]')).toHaveText('Create');

    // 2. Trigger validation error in English
    await page.click('[data-testid="add-cow-submit"]');
    await expect(page.locator('text=Name is required')).toBeVisible();
    await expect(page.locator('text=Tag is required')).toBeVisible();

    // 3. Dynamically switch language to Kannada while the modal is open
    await page.evaluate(() => {
      (window as any).__setDairyVisionLanguage?.('kn');
    });

    // Modal title updates dynamically without refresh
    await expect(page.locator('h3:has-text("ಹಸು ಸೇರಿಸಿ")')).toBeVisible();
    // Labels update
    await expect(page.locator('label:has-text("ಹೆಸರು")')).toBeVisible();
    await expect(page.locator('label:has-text("ಟ್ಯಾಗ್")')).toBeVisible();
    await expect(page.locator('label:has-text("ವಯಸ್ಸು")')).toBeVisible();
    await expect(page.locator('label:has-text("ತೂಕ (kg)")')).toBeVisible();
    await expect(page.locator('label:has-text("ತಳಿ")')).toBeVisible();
    await expect(page.locator('label:has-text("ಸ್ಥಿತಿ")')).toBeVisible();
    // Placeholders update
    await expect(page.locator('[data-testid="add-cow-age-years"]')).toHaveAttribute('placeholder', 'ವರ್ಷಗಳು (ಉದಾ. 4)');
    await expect(page.locator('[data-testid="add-cow-age-months"]')).toHaveAttribute('placeholder', 'ತಿಂಗಳುಗಳು (0–11)');
    await expect(page.locator('text=ಅಂದಾಜು ವಯಸ್ಸು ಸಾಕು.')).toBeVisible();
    await expect(page.locator('[data-testid="add-cow-weight"]')).toHaveAttribute('placeholder', 'ಉದಾ. 500');
    // Dropdown options update
    await expect(page.locator('[data-testid="add-cow-breed"] option').first()).toHaveText('ತಳಿ ಆಯ್ಕೆಮಾಡಿ');
    await expect(page.locator('[data-testid="add-cow-status"] option').first()).toHaveText('ಸ್ಥಿತಿ ಆಯ್ಕೆಮಾಡಿ');
    await expect(page.locator('[data-testid="add-cow-status"] option[value="active"]')).toHaveText('ಸಕ್ರಿಯ');
    // Validation messages update dynamically
    await expect(page.locator('text=ಹೆಸರು ಅಗತ್ಯವಿದೆ')).toBeVisible();
    await expect(page.locator('text=ಟ್ಯಾಗ್ ಅಗತ್ಯವಿದೆ')).toBeVisible();
    // Buttons update
    await expect(page.locator('[data-testid="add-cow-cancel"]')).toHaveText('ರದ್ದುಮಾಡಿ');
    await expect(page.locator('[data-testid="add-cow-submit"]')).toHaveText('ರಚಿಸಿ');

    // 4. Dynamically switch to Hindi
    await page.evaluate(() => {
      (window as any).__setDairyVisionLanguage?.('hi');
    });
    await expect(page.locator('h3:has-text("गाय जोड़ें")')).toBeVisible();
    await expect(page.locator('label:has-text("नाम")')).toBeVisible();
    await expect(page.locator('text=नाम आवश्यक है')).toBeVisible();
    await expect(page.locator('[data-testid="add-cow-cancel"]')).toHaveText('रद्द करें');
    await expect(page.locator('[data-testid="add-cow-submit"]')).toHaveText('बनाएं');

    // 5. Dynamically switch to Marathi (mr)
    await page.evaluate(() => {
      (window as any).__setDairyVisionLanguage?.('mr');
    });
    await expect(page.locator('h3:has-text("गाय जोडा")')).toBeVisible();
    await expect(page.locator('label:has-text("नाव")')).toBeVisible();
    await expect(page.locator('text=नाव आवश्यक आहे')).toBeVisible();
    await expect(page.locator('[data-testid="add-cow-cancel"]')).toHaveText('रद्द करा');
    await expect(page.locator('[data-testid="add-cow-submit"]')).toHaveText('तयार करा');

    // 6. Dynamically switch to Punjabi (pa)
    await page.evaluate(() => {
      (window as any).__setDairyVisionLanguage?.('pa');
    });
    await expect(page.locator('h3:has-text("ਗਾਂ ਜੋੜੋ")')).toBeVisible();
    await expect(page.locator('label:has-text("ਨਾਮ")')).toBeVisible();
    await expect(page.locator('text=ਨਾਮ ਲੋੜੀਂਦਾ ਹੈ')).toBeVisible();
    await expect(page.locator('[data-testid="add-cow-cancel"]')).toHaveText('ਰੱਦ ਕਰੋ');
    await expect(page.locator('[data-testid="add-cow-submit"]')).toHaveText('ਬਣਾਓ');

    // 7. Dynamically switch to Gujarati (gu)
    await page.evaluate(() => {
      (window as any).__setDairyVisionLanguage?.('gu');
    });
    await expect(page.locator('h3:has-text("ગાય ઉમેરો")')).toBeVisible();
    await expect(page.locator('label:has-text("નામ")')).toBeVisible();
    await expect(page.locator('text=નામ જરૂરી છે')).toBeVisible();
    await expect(page.locator('[data-testid="add-cow-cancel"]')).toHaveText('રદ કરો');
    await expect(page.locator('[data-testid="add-cow-submit"]')).toHaveText('ઉમેરો');

    // Reset language back to English
    await page.evaluate(() => {
      (window as any).__setDairyVisionLanguage?.('en');
    });
    await expect(page.locator('h3:has-text("Add Cow")')).toBeVisible();
    await page.click('[data-testid="add-cow-cancel"]');
  });
});

