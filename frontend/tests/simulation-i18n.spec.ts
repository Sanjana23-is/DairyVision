import { test, expect } from '@playwright/test';
import { translations, SupportedLanguage } from '../src/i18n/translations';

test.describe('DairyVision AI What-If Simulation Complete Internationalization (6 Languages)', () => {
  const supportedLanguages: SupportedLanguage[] = ['en', 'hi', 'mr', 'pa', 'gu', 'kn'];

  // 1. Static Dictionary Key Parity Test
  test('verify 100% translation dictionary key parity across all 6 languages for What-If Simulation', () => {
    const enKeys = Object.keys(translations.en);
    const simKeys = enKeys.filter((k) => k.startsWith('sim.'));

    expect(simKeys.length, 'Simulation should have comprehensive translation keys').toBeGreaterThan(70);

    for (const lang of supportedLanguages) {
      const langKeys = Object.keys(translations[lang]);
      expect(langKeys.length, `Language ${lang} should have exact same key count as en`).toBe(enKeys.length);

      const missingInLang = enKeys.filter((k) => !(k in translations[lang]));
      expect(missingInLang, `Language ${lang} has missing keys`).toEqual([]);

      // Ensure no empty string or undefined values for all sim keys
      for (const k of simKeys) {
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
    await page.waitForTimeout(400);
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

  // 3. Complete Page Verification across all 6 languages for Single Cow Simulation
  test('should render Single Cow scenario controls and results correctly in all 6 languages', async ({ page }) => {
    await page.goto('http://localhost:3000/simulation');
    await page.waitForTimeout(1000);

    // Ensure Ganga (who has daily observations) is selected
    const cowSelect = page.locator('select');
    await cowSelect.waitFor({ state: 'visible', timeout: 7000 });
    const gangaOpt = cowSelect.locator('option:has-text("Ganga")').first();
    if (await gangaOpt.count() > 0) {
      const val = await gangaOpt.getAttribute('value');
      if (val) {
        await cowSelect.selectOption(val);
      }
    }

    for (const lang of supportedLanguages) {
      await selectLanguage(page, lang);

      // Verify Header and Badges
      const expectedTitle = translations[lang]['sim.title'];
      const expectedSandbox = translations[lang]['sim.sandbox'];
      await expect(page.locator(`h1:has-text("${expectedTitle}")`).first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator(`text=${expectedSandbox}`).first()).toBeVisible();

      // Verify Mode Switchers
      const expectedIndividualCow = translations[lang]['sim.individual_cow'];
      const expectedHerd = translations[lang]['sim.herd'];
      await expect(page.locator(`button:has-text("${expectedIndividualCow}")`).first()).toBeVisible();
      await expect(page.locator(`button:has-text("${expectedHerd}")`).first()).toBeVisible();

      // Verify Quick Presets
      const expectedPresets = translations[lang]['sim.quick_presets'];
      const expectedHeatwave = translations[lang]['sim.severe_heatwave'];
      const expectedCooling = translations[lang]['sim.active_cooling'];
      const expectedFeed = translations[lang]['sim.high_energy_ration'];
      const expectedReset = translations[lang]['sim.reset_baseline'];
      await expect(page.locator(`text=${expectedPresets}`).first()).toBeVisible();
      await expect(page.locator(`button:has-text("${expectedHeatwave}")`).first()).toBeVisible();
      await expect(page.locator(`button:has-text("${expectedCooling}")`).first()).toBeVisible();
      await expect(page.locator(`button:has-text("${expectedFeed}")`).first()).toBeVisible();
      await expect(page.locator(`button:has-text("${expectedReset}")`).first()).toBeVisible();

      // Verify Control Panel
      const expectedPanelTitle = translations[lang]['sim.scenario_panel'];
      const expectedSelectCow = translations[lang]['sim.select_cow'];
      const expectedAmbientTemp = translations[lang]['sim.ambient_temp'];
      const expectedHumidity = translations[lang]['sim.relative_humidity'];
      const expectedFeedRation = translations[lang]['sim.feed_ration'];
      const expectedCoolingReduction = translations[lang]['sim.cooling_reduction'];
      const expectedOverride = translations[lang]['sim.override_prices'];

      await expect(page.locator(`h3:has-text("${expectedPanelTitle}")`).first()).toBeVisible();
      await expect(page.locator(`text=${expectedSelectCow}`).first()).toBeVisible();
      await expect(page.locator(`text=${expectedAmbientTemp}`).first()).toBeVisible();
      await expect(page.locator(`text=${expectedHumidity}`).first()).toBeVisible();
      await expect(page.locator(`text=${expectedFeedRation}`).first()).toBeVisible();
      await expect(page.locator(`text=${expectedCoolingReduction}`).first()).toBeVisible();
      await expect(page.locator(`text=${expectedOverride}`).first()).toBeVisible();

      // Verify Recalculate Button
      const expectedRecalculate = translations[lang]['sim.recalculate'];
      await expect(page.locator(`button:has-text("${expectedRecalculate}")`).first()).toBeVisible();

      // Verify Single Cow Results (if loaded)
      const singleCowBadge = translations[lang]['sim.single_cow_scenario'];
      const predictedYield = translations[lang]['sim.predicted_milk_yield'];
      const vitalityScore = translations[lang]['sim.vitality_score'];
      const thermalStressShift = translations[lang]['sim.thermal_stress_shift'];
      const baselineThi = translations[lang]['sim.baseline_thi'];
      const simulatedThi = translations[lang]['sim.simulated_thi'];
      const whyResultChanged = translations[lang]['sim.why_result_changed'];

      await expect(page.locator(`text=${singleCowBadge}`).first()).toBeVisible({ timeout: 7000 });
      await expect(page.locator(`text=${predictedYield}`).first()).toBeVisible();
      await expect(page.locator(`text=${vitalityScore}`).first()).toBeVisible();
      await expect(page.locator(`text=${thermalStressShift}`).first()).toBeVisible();
      await expect(page.locator(`text=${baselineThi}`).first()).toBeVisible();
      await expect(page.locator(`text=${simulatedThi}`).first()).toBeVisible();
      await expect(page.locator(`text=${whyResultChanged}`).first()).toBeVisible();

      // Verify Financial Impact Card
      const finTitle = translations[lang]['sim.fin.cow_title'];
      const finDaily = translations[lang]['sim.fin.daily_impact'];
      const finMonthly = translations[lang]['sim.fin.monthly_impact'];
      const finBenefit = translations[lang]['sim.fin.net_benefit'];
      const finWhy = translations[lang]['sim.fin.why_impact'];
      const finTransp = translations[lang]['sim.fin.transparency_note'];

      await expect(page.locator(`h3:has-text("${finTitle}")`).first()).toBeVisible();
      await expect(page.locator(`text=${finDaily}`).first()).toBeVisible();
      await expect(page.locator(`text=${finMonthly}`).first()).toBeVisible();
      await expect(page.locator(`text=${finBenefit}`).first()).toBeVisible();
      await expect(page.locator(`h4:has-text("${finWhy}")`).first()).toBeVisible();
      await expect(page.locator(`text=${finTransp}`).first()).toBeVisible();
    }
  });

  // 4. Verify Herd Scenario Mode and Table across languages
  test('should render Herd Scenario mode, aggregations, and table in all 6 languages', async ({ page }) => {
    await page.goto('http://localhost:3000/simulation');
    await page.waitForTimeout(1000);

    // Switch to Herd mode
    const herdTabBtn = page.locator('button:has-text("Herd"), button:has-text("ਝੁੰਡ"), button:has-text("कळप"), button:has-text("हर्ड")').first();
    await herdTabBtn.click();
    await page.waitForTimeout(600);

    for (const lang of supportedLanguages) {
      await selectLanguage(page, lang);

      // Verify Herd results cards
      const herdMilkImpact = translations[lang]['sim.herd_milk_impact'];
      const herdScopeSummary = translations[lang]['sim.herd_scope_summary'];
      const activeHerd = translations[lang]['sim.simulated_active_herd'];
      const cowBreakdown = translations[lang]['sim.cow_breakdown'];

      await expect(page.locator(`text=${herdMilkImpact}`).first()).toBeVisible({ timeout: 7000 });
      await expect(page.locator(`text=${herdScopeSummary}`).first()).toBeVisible();
      await expect(page.locator(`text=${activeHerd}`).first()).toBeVisible();
      await expect(page.locator(`text=${cowBreakdown}`).first()).toBeVisible();

      // Verify Table Headers
      const colCowName = translations[lang]['sim.table.cow_name'];
      const colBaseline = translations[lang]['sim.table.baseline_yield'];
      const colSimulated = translations[lang]['sim.table.simulated_yield'];
      const colDelta = translations[lang]['sim.table.delta'];
      const colThi = translations[lang]['sim.table.thi_shift'];
      const colHealth = translations[lang]['sim.table.health_status'];

      await expect(page.locator(`th:has-text("${colCowName}")`).first()).toBeVisible();
      await expect(page.locator(`th:has-text("${colBaseline}")`).first()).toBeVisible();
      await expect(page.locator(`th:has-text("${colSimulated}")`).first()).toBeVisible();
      await expect(page.locator(`th:has-text("${colDelta}")`).first()).toBeVisible();
      await expect(page.locator(`th:has-text("${colThi}")`).first()).toBeVisible();
      await expect(page.locator(`th:has-text("${colHealth}")`).first()).toBeVisible();

      // Verify Herd Financial Impact Card
      const herdFinTitle = translations[lang]['sim.fin.herd_title'];
      const herdFinDaily = translations[lang]['sim.fin.herd_daily_impact'];
      await expect(page.locator(`h3:has-text("${herdFinTitle}")`).first()).toBeVisible();
      await expect(page.locator(`text=${herdFinDaily}`).first()).toBeVisible();
    }
  });

  // 5. Verification of Specific Punjabi and Marathi Text Reported by User
  test('verify Punjabi and Marathi specific What-If Simulation strings are fully translated', async ({ page }) => {
    await page.goto('http://localhost:3000/simulation');
    await page.waitForTimeout(1000);

    // Ensure Ganga is selected
    const cowSelect = page.locator('select');
    await cowSelect.waitFor({ state: 'visible', timeout: 7000 });
    const gangaOpt = cowSelect.locator('option:has-text("Ganga")').first();
    if (await gangaOpt.count() > 0) {
      const val = await gangaOpt.getAttribute('value');
      if (val) {
        await cowSelect.selectOption(val);
      }
    }

    // Switch to Punjabi
    await selectLanguage(page, 'pa');
    await expect(page.locator(`text=${translations.pa['sim.single_cow_scenario']}`).first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text=${translations.pa['sim.predicted_milk_yield']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.pa['sim.baseline_yield']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.pa['sim.vitality_score']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.pa['sim.health_status_label']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.pa['sim.thermal_stress_shift']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.pa['sim.why_result_changed']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.pa['sim.fin.cow_title']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.pa['sim.fin.daily_impact']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.pa['sim.fin.why_impact']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.pa['sim.fin.transparency_note']}`).first()).toBeVisible();

    // Switch to Marathi
    await selectLanguage(page, 'mr');
    await expect(page.locator(`text=${translations.mr['sim.single_cow_scenario']}`).first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text=${translations.mr['sim.predicted_milk_yield']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.mr['sim.baseline_yield']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.mr['sim.vitality_score']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.mr['sim.health_status_label']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.mr['sim.thermal_stress_shift']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.mr['sim.why_result_changed']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.mr['sim.fin.cow_title']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.mr['sim.fin.daily_impact']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.mr['sim.fin.why_impact']}`).first()).toBeVisible();
    await expect(page.locator(`text=${translations.mr['sim.fin.transparency_note']}`).first()).toBeVisible();
  });
});
