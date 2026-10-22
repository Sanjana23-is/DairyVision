import { test, expect } from '@playwright/test';
import { translations, SupportedLanguage } from '../src/i18n/translations';

test.describe('DairyVision AI Digital Twin Complete Internationalization (6 Languages)', () => {
  const supportedLanguages: SupportedLanguage[] = ['en', 'hi', 'mr', 'pa', 'gu', 'kn'];

  // 1. Static Dictionary Key Parity Test
  test('verify 100% translation dictionary key parity across all 6 languages for Digital Twin', () => {
    const enKeys = Object.keys(translations.en);
    const twinKeys = enKeys.filter((k) => k.startsWith('twin.'));

    expect(twinKeys.length, 'Digital Twin should have comprehensive translation keys').toBeGreaterThan(80);

    for (const lang of supportedLanguages) {
      const langKeys = Object.keys(translations[lang]);
      expect(langKeys.length, `Language ${lang} should have exact same key count as en`).toBe(enKeys.length);

      const missingInLang = enKeys.filter((k) => !(k in translations[lang]));
      expect(missingInLang, `Language ${lang} has missing keys`).toEqual([]);

      // Ensure no empty string or undefined values for all keys
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

  // 2. Authentication Setup
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

  // 3. Complete Page Verification across all 6 languages
  test('should render Digital Twin page and components correctly in all 6 languages', async ({ page }) => {
    await page.goto('http://localhost:3000/digital-twin');
    await page.waitForTimeout(600);

    for (const lang of supportedLanguages) {
      await selectLanguage(page, lang);

      // Verify page title
      const expectedTitle = translations[lang]['twin.title'];
      await expect(page.locator(`h1:has-text("${expectedTitle}")`).first()).toBeVisible({ timeout: 5000 });

      // Verify Real-Time badge
      const expectedRealtime = translations[lang]['twin.realtime'];
      await expect(page.locator(`text=${expectedRealtime}`).first()).toBeVisible();

      // Verify KPI Cards
      const expectedVitality = translations[lang]['twin.vitality_index'];
      const expectedDailyMilk = translations[lang]['twin.daily_milk'];
      const expectedHealthDist = translations[lang]['twin.health_dist'];
      const expectedTotalActive = translations[lang]['twin.total_active'];
      await expect(page.locator(`text=${expectedVitality}`).first()).toBeVisible();
      await expect(page.locator(`text=${expectedDailyMilk}`).first()).toBeVisible();
      await expect(page.locator(`text=${expectedHealthDist}`).first()).toBeVisible();
      await expect(page.locator(`text=${expectedTotalActive}`).first()).toBeVisible();

      // Verify Filter Buttons
      const expectedFilterAll = translations[lang]['twin.filter_all'];
      const expectedFilterAttention = translations[lang]['twin.filter_attention'];
      const expectedFilterHealthRisk = translations[lang]['twin.filter_health_risk'];
      const expectedFilterHeatStress = translations[lang]['twin.filter_heat_stress'];
      await expect(page.locator(`button:has-text("${expectedFilterAll}")`).first()).toBeVisible();
      await expect(page.locator(`button:has-text("${expectedFilterAttention}")`).first()).toBeVisible();
      await expect(page.locator(`button:has-text("${expectedFilterHealthRisk}")`).first()).toBeVisible();
      await expect(page.locator(`button:has-text("${expectedFilterHeatStress}")`).first()).toBeVisible();

      // Verify Triage Grid Header
      const expectedTriageGrid = translations[lang]['twin.triage_grid'];
      await expect(page.locator(`text=${expectedTriageGrid}`).first()).toBeVisible();

      // Verify Detailed State Header & Vitality Gauge
      const expectedDetailedState = translations[lang]['twin.detailed_state'];
      const expectedVitalityGauge = translations[lang]['twin.vitality_gauge'];
      await expect(page.locator(`text=${expectedDetailedState}`).first()).toBeVisible();
      await expect(page.locator(`text=${expectedVitalityGauge}`).first()).toBeVisible();

      // Verify Vital Signs Section Header
      const expectedVitalSignsTitle = translations[lang]['twin.vital_signs_title'];
      await expect(page.locator(`text=${expectedVitalSignsTitle}`).first()).toBeVisible();

      // Verify Milk Performance Section Header
      const expectedMilkPerfTitle = translations[lang]['twin.milk_perf_title'];
      await expect(page.locator(`text=${expectedMilkPerfTitle}`).first()).toBeVisible();

      // Verify Current Yield & Predicted Target labels
      const expectedCurrentYield = translations[lang]['twin.current_yield'];
      const expectedPredictedTarget = translations[lang]['twin.predicted_target'];
      await expect(page.locator(`text=${expectedCurrentYield}`).first()).toBeVisible();
      await expect(page.locator(`text=${expectedPredictedTarget}`).first()).toBeVisible();

      // Verify Key Drivers Section Header
      const expectedKeyDriversTitle = translations[lang]['twin.key_drivers_title'];
      await expect(page.locator(`text=${expectedKeyDriversTitle}`).first()).toBeVisible();

      // Verify Footer Branding
      const expectedBranding = translations[lang]['twin.engine_branding'];
      await expect(page.locator(`text=${expectedBranding}`).first()).toBeVisible();
    }
  });

  // 4. Specific Mixed-Language Fix Verification for Punjabi & Marathi
  test('verify Punjabi and Marathi leave no untranslated English labels on Digital Twin page', async ({ page }) => {
    await page.goto('http://localhost:3000/digital-twin');
    await page.waitForTimeout(600);

    // Test Punjabi
    await selectLanguage(page, 'pa');

    // Punjabi checks:
    // 1. Filter buttons should have Punjabi labels
    await expect(page.locator('button:has-text("ਸਾਰੇ")').first()).toBeVisible();
    await expect(page.locator('button:has-text("ਧਿਆਨ ਦਿਓ")').first()).toBeVisible();
    await expect(page.locator('button:has-text("ਸਿਹਤ ਜੋਖਮ")').first()).toBeVisible();
    await expect(page.locator('button:has-text("ਗਰਮੀ ਤਣਾਅ")').first()).toBeVisible();

    // 2. Health distribution card counts
    await expect(page.locator('text=ਤੰਦਰੁਸਤ').first()).toBeVisible();

    // 3. Cow card Vitality Index label
    await expect(page.locator('span:has-text("ਜੀਵਨ ਸ਼ਕਤੀ ਸੂਚਕਾਂਕ")').first()).toBeVisible();

    // 4. Cow card Yield label
    await expect(page.locator('text=ਉਤਪਾਦਨ:').first()).toBeVisible();

    // 5. THI status in cow card should NOT be "THI: Comfort" in English, but "THI: ਸੁਖਾਵਾਂ"
    await expect(page.locator('text=THI: ਸੁਖਾਵਾਂ').first()).toBeVisible();

    // 6. Milk Performance title
    await expect(page.locator('text=ਦੁੱਧ ਉਤਪਾਦਨ ਕਾਰਗੁਜ਼ਾਰੀ ਬਨਾਮ AI ਅਨੁਮਾਨ ਬੇਸਲਾਈਨ').first()).toBeVisible();

    // Now test Marathi
    await selectLanguage(page, 'mr');

    // Marathi checks:
    await expect(page.locator('button:has-text("सर्व")').first()).toBeVisible();
    await expect(page.locator('button:has-text("लक्ष द्या")').first()).toBeVisible();
    await expect(page.locator('button:has-text("आरोग्य जोखीम")').first()).toBeVisible();
    await expect(page.locator('button:has-text("उष्णतेचा ताण")').first()).toBeVisible();

    // Cow card Vitality Index label
    await expect(page.locator(`span:has-text("${translations.mr['twin.vitality_index_label']}")`).first()).toBeVisible();

    // Cow card Yield label
    await expect(page.locator('text=उत्पादन:').first()).toBeVisible();

    // THI status in Marathi
    await expect(page.locator('text=THI: सुखकर').first()).toBeVisible();

    // Milk Performance title
    await expect(page.locator('text=दूध उत्पादन कामगिरी विरुद्ध AI अंदाज आधारभूत पातळी').first()).toBeVisible();
  });

  // 5. Dynamic Switching Across Cow Selection without Page Reload
  test('verify dynamic language switching updates selected cow details in real-time', async ({ page }) => {
    await page.goto('http://localhost:3000/digital-twin');
    await page.waitForTimeout(600);

    // Start in English
    await selectLanguage(page, 'en');
    await expect(page.locator('h1:has-text("Digital Twin")')).toBeVisible();

    // Select second cow card if available
    const cowCards = page.locator('div[class*="cursor-pointer rounded-2xl border"]');
    const count = await cowCards.count();
    if (count > 1) {
      await cowCards.nth(1).click();
      await page.waitForTimeout(300);
    }

    // Switch to Hindi
    await selectLanguage(page, 'hi');
    await expect(page.locator('h1:has-text("डिजिटल ट्विन")')).toBeVisible();
    await expect(page.locator('text=झुंड जीवन शक्ति सूचकांक')).toBeVisible();
    await expect(page.locator('text=THI: आराम').first()).toBeVisible();

    // Switch to Gujarati
    await selectLanguage(page, 'gu');
    await expect(page.locator('h1:has-text("ડિજિટલ ટ્વિન")')).toBeVisible();
    await expect(page.locator('button:has-text("બધા")')).toBeVisible();
    await expect(page.locator('text=THI: સુખદ').first()).toBeVisible();

    // Switch to Kannada
    await selectLanguage(page, 'kn');
    await expect(page.locator('h1:has-text("ಡಿಜಿಟಲ್ ಟ್ವಿನ್")')).toBeVisible();
    await expect(page.locator('button:has-text("ಎಲ್ಲವೂ")')).toBeVisible();
    await expect(page.locator('text=THI: ಆರಾಮದಾಯಕ').first()).toBeVisible();
  });
});
