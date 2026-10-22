import { test, expect } from '@playwright/test';
import { translations, SupportedLanguage } from '../src/i18n/translations';

test.describe('Health & Risk Center Complete Internationalization (6 Languages)', () => {
  // 1. Static Dictionary Key Parity Test
  test('verify 100% translation dictionary key parity across all 6 languages', () => {
    const supportedLanguages: SupportedLanguage[] = ['en', 'hi', 'mr', 'pa', 'gu', 'kn'];
    const enKeys = Object.keys(translations.en);

    expect(enKeys.length).toBeGreaterThan(500);

    for (const lang of supportedLanguages) {
      const langKeys = Object.keys(translations[lang]);
      expect(langKeys.length, `Language ${lang} should have exact same key count as en`).toBe(enKeys.length);

      const missingInLang = enKeys.filter((k) => !(k in translations[lang]));
      expect(missingInLang, `Language ${lang} has missing keys`).toEqual([]);

      // Ensure no empty string or undefined values
      for (const k of enKeys) {
        const val = translations[lang][k];
        expect(typeof val, `Key ${k} in ${lang} must be string`).toBe('string');
        expect(val.trim().length, `Key ${k} in ${lang} must not be empty`).toBeGreaterThan(0);
      }
    }
  });

  // Helper function to switch language using the Navbar dropdown
  async function selectLanguage(page: any, langCode: SupportedLanguage) {
    const toggle = page.locator('[data-testid="language-dropdown-toggle"]');
    await expect(toggle).toBeVisible({ timeout: 5000 });
    await toggle.click();

    const opt = page.locator(`[data-testid="lang-option-${langCode}"]`);
    await expect(opt).toBeVisible({ timeout: 5000 });
    await opt.click();
    await page.waitForTimeout(300);
  }

  // 2. E2E Browser Testing across all 6 languages
  test.beforeEach(async ({ page }) => {
    // Log in with demo credentials
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'demo.farmer@dairyvision.ai');
    await page.fill('input[type="password"]', 'DairyVisionDemo2026!');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard or select-farm
    await page.waitForURL((url) => url.pathname.includes('/dashboard') || url.pathname.includes('/select-farm'), {
      timeout: 10000,
    });

    if (page.url().includes('/select-farm')) {
      await page.click('button:has-text("Enter Farm")');
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    }
  });

  test('should render main Health & Risk Center page correctly in all 6 languages', async ({ page }) => {
    await page.goto('http://localhost:3000/health-alerts');
    await page.waitForTimeout(500);

    const supportedLanguages: SupportedLanguage[] = ['en', 'hi', 'mr', 'pa', 'gu', 'kn'];

    for (const lang of supportedLanguages) {
      await selectLanguage(page, lang);

      // Verify page title
      const expectedTitle = translations[lang]['health.center_title'];
      await expect(page.locator(`text=${expectedTitle}`).first()).toBeVisible({ timeout: 5000 });

      // Verify Healthy Herd KPI card
      const expectedHealthy = translations[lang]['health.healthy_herd'];
      await expect(page.locator(`text=${expectedHealthy}`).first()).toBeVisible();

      // Verify Export button
      const expectedExport = translations[lang]['health.export'];
      await expect(page.locator(`text=${expectedExport}`).first()).toBeVisible();

      // Verify Cow card Action button
      const expectedViewCow = translations[lang]['common.view_cow'];
      await expect(page.locator(`button:has-text("${expectedViewCow}")`).first()).toBeVisible();
    }
  });

  test('should open cow detail modal and dynamically update translations in real-time when switching language', async ({ page }) => {
    await page.goto('http://localhost:3000/health-alerts');
    await page.waitForTimeout(500);

    // Ensure English initially
    await selectLanguage(page, 'en');

    // Click on Healthy Herd filter to ensure cards are visible
    await page.click('text=Healthy Herd');
    await page.waitForTimeout(300);

    // Open first cow card modal
    const viewCowBtn = page.locator('button:has-text("View Cow")').first();
    await expect(viewCowBtn).toBeVisible({ timeout: 5000 });
    await viewCowBtn.click();

    // Verify modal container is open in English
    const modal = page.locator('.fixed.inset-0');
    await expect(modal).toBeVisible({ timeout: 5000 });

    await expect(modal.locator('text=Why is this cow flagged?')).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('text=Historical Production Evidence')).toBeVisible();
    await expect(modal.locator('text=Tailored Management Recommendations')).toBeVisible();
    await expect(modal.locator('text=Recent Activity & Clinical Audit')).toBeVisible();
    await expect(modal.locator('text=Total milk produced per day (litres)').first()).toBeVisible();

    // Preserve Data Semantics: verify Cow Identity tag and measurements exist inside modal
    const modalText = await modal.textContent();
    expect(modalText).toContain('·'); // Separator between Cow Name and Tag ID
    expect(modalText).toContain('L');

    // TEST DYNAMIC SWITCHING WITH MODAL OPEN:
    const modalLangSelect = modal.locator('[data-testid="modal-language-selector"]');
    await expect(modalLangSelect).toBeVisible();

    // 1. Switch to Hindi while modal is open!
    await modalLangSelect.selectOption('hi');
    await page.waitForTimeout(300);
    await expect(modal.locator(`text="${translations.hi['modal.why_flagged']}"`).first()).toBeVisible({ timeout: 5000 });
    await expect(modal.locator(`text="${translations.hi['modal.recent_activity']}"`).first()).toBeVisible();
    await expect(modal.locator(`text="${translations.hi['dimension.recorded_health']}"`).first()).toBeVisible();
    await expect(modal.locator(`text="${translations.hi['dimension.milk_production']}"`).first()).toBeVisible();
    await expect(modal.locator(`text="${translations.hi['dimension.ai_monitoring']}"`).first()).toBeVisible();

    // 2. Switch to Kannada while modal is open!
    await modalLangSelect.selectOption('kn');
    await page.waitForTimeout(300);
    await expect(modal.locator(`text="${translations.kn['modal.why_flagged']}"`).first()).toBeVisible({ timeout: 5000 });
    await expect(modal.locator(`text="${translations.kn['dimension.recorded_health']}"`).first()).toBeVisible();
    await expect(modal.locator(`text="${translations.kn['dimension.milk_production']}"`).first()).toBeVisible();
    await expect(modal.locator(`text="${translations.kn['dimension.ai_monitoring']}"`).first()).toBeVisible();

    // 3. Switch to Marathi while modal is open!
    await modalLangSelect.selectOption('mr');
    await page.waitForTimeout(300);
    await expect(modal.locator(`text="${translations.mr['modal.why_flagged']}"`).first()).toBeVisible({ timeout: 5000 });
    await expect(modal.locator(`text="${translations.mr['modal.recent_activity']}"`).first()).toBeVisible();

    // 4. Switch to Punjabi while modal is open!
    await modalLangSelect.selectOption('pa');
    await page.waitForTimeout(300);
    await expect(modal.locator(`text="${translations.pa['modal.why_flagged']}"`).first()).toBeVisible({ timeout: 5000 });
    await expect(modal.locator(`text="${translations.pa['modal.recent_activity']}"`).first()).toBeVisible();

    // 5. Switch to Gujarati while modal is open!
    await modalLangSelect.selectOption('gu');
    await page.waitForTimeout(300);
    await expect(modal.locator(`text="${translations.gu['modal.why_flagged']}"`).first()).toBeVisible({ timeout: 5000 });
    await expect(modal.locator(`text="${translations.gu['modal.recent_activity']}"`).first()).toBeVisible();

    // Close modal via close button
    const closeBtn = modal.locator(`button:has-text("${translations.gu['common.close']}")`);
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Modal should now be closed
    await expect(modal).not.toBeVisible();
  });

  // 4. Specific Regression Test: Recorded Health Status translation ("No recorded health concern in latest daily log")
  test('should properly translate recorded health status across all 6 languages in cow detail modal', async ({ page }) => {
    await page.goto('http://localhost:3000/health-alerts');
    await page.waitForTimeout(500);

    // Ensure English initially
    await selectLanguage(page, 'en');

    // Open cow card modal for Ganga (KA-01-G-101 has daily observations with normal health logs)
    const gangaCard = page.locator('[data-testid="cow-card-KA-01-G-101"]');
    await expect(gangaCard).toBeVisible({ timeout: 5000 });
    const viewCowBtn = gangaCard.locator('button:has-text("View Cow")');
    await expect(viewCowBtn).toBeVisible({ timeout: 5000 });
    await viewCowBtn.click();

    const modal = page.locator('.fixed.inset-0');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const modalLangSelect = modal.locator('[data-testid="modal-language-selector"]');
    await expect(modalLangSelect).toBeVisible();

    const languages: SupportedLanguage[] = ['en', 'hi', 'mr', 'pa', 'gu', 'kn'];

    for (const lang of languages) {
      await modalLangSelect.selectOption(lang);
      await page.waitForTimeout(300);

      const expectedHealthLabel = translations[lang]['risk.health_no_concern'];
      await expect(modal.locator(`text="${expectedHealthLabel}"`).first()).toBeVisible({ timeout: 5000 });

      // In non-English languages, verify English fallback text is NOT present
      if (lang !== 'en') {
        const englishFallback = translations.en['risk.health_no_concern'];
        await expect(modal.locator(`text="${englishFallback}"`)).toHaveCount(0);
      }
    }

    // Close modal
    const closeBtn = modal.locator('button').filter({ hasText: /Close|बंद करें|बंद करा|ਬੰਦ ਕਰੋ|બંધ કરો|ಮುಚ್ಚಿ/ }).first();
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });
});
