import { test, expect } from '@playwright/test';
import { translations, SupportedLanguage } from '../src/i18n/translations';

test.describe('DairyVision AI Explainability Complete Internationalization (6 Languages)', () => {
  const supportedLanguages: SupportedLanguage[] = ['en', 'hi', 'mr', 'pa', 'gu', 'kn'];

  // 1. Static Dictionary Key Parity Test
  test('verify 100% translation dictionary key parity across all 6 languages for Explainability', () => {
    const enKeys = Object.keys(translations.en);
    const explainKeys = enKeys.filter((k) => k.startsWith('explain.') || k.startsWith('feat.'));

    expect(explainKeys.length, 'Explainability should have comprehensive translation keys').toBeGreaterThan(80);

    for (const lang of supportedLanguages) {
      const langKeys = Object.keys(translations[lang]);
      expect(langKeys.length, `Language ${lang} should have exact same key count as en`).toBe(enKeys.length);

      const missingInLang = enKeys.filter((k) => !(k in translations[lang]));
      expect(missingInLang, `Language ${lang} has missing keys`).toEqual([]);

      // Ensure no empty string or undefined values for all explainability keys
      for (const k of explainKeys) {
        const val = translations[lang][k];
        expect(typeof val, `Key ${k} in ${lang} must be string`).toBe('string');
        expect(val.trim().length, `Key ${k} in ${lang} must not be empty`).toBeGreaterThan(0);
      }
    }
  });

  // Helper function to switch language using the Navbar dropdown
  async function selectLanguage(page: any, langCode: SupportedLanguage) {
    const toggle = page.locator('[data-testid="language-dropdown-toggle"]');
    await expect(toggle).toBeVisible({ timeout: 7000 });
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

  // 3. Live Language Switching & Cow Local (SHAP) View in all 6 Languages
  test('should render Cow Local explainability and prediction history correctly in all 6 languages', async ({ page }) => {
    await page.goto('http://localhost:3000/explainability');
    await page.waitForTimeout(1000);

    // If selector is present, ensure a cow with predictions is selected
    const cowSelect = page.locator('#cow-selector');
    if (await cowSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      const gangaOpt = cowSelect.locator('option:has-text("Ganga")').first();
      if (await gangaOpt.count() > 0) {
        const val = await gangaOpt.getAttribute('value');
        if (val) {
          await cowSelect.selectOption(val);
          await page.waitForTimeout(500);
        }
      }
    }

    // Verify specifically across all 6 languages
    for (const lang of supportedLanguages) {
      await selectLanguage(page, lang);

      // 1. Verify Page Title & Tabs
      const expectedTitle = translations[lang]['explain.title'];
      const expectedLocalTab = translations[lang]['explain.cow_local'];
      const expectedArchTab = translations[lang]['explain.model_arch'];

      await expect(page.locator(`text=${expectedTitle}`).first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator(`button:has-text("${expectedLocalTab}")`).first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator(`button:has-text("${expectedArchTab}")`).first()).toBeVisible({ timeout: 5000 });

      // 2. Verify Prediction History Header & Subtitle
      const expectedHistory = translations[lang]['explain.prediction_history'];
      const expectedShowing = translations[lang]['explain.showing_history_for'];
      await expect(page.locator(`text=${expectedHistory}`).first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator(`text=${expectedShowing}`).first()).toBeVisible({ timeout: 5000 });

      // 3. Verify Context Summary Bar (Subject Cow, Observation Date, Predicted Yield)
      const expectedCowLabel = translations[lang]['explain.subject_cow'];
      const expectedDateLabel = translations[lang]['explain.observation_date'];
      await expect(page.locator(`text=${expectedCowLabel}`).first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator(`text=${expectedDateLabel}`).first()).toBeVisible({ timeout: 5000 });

      // 4. Verify Why This Prediction & Main Factors Section
      const expectedWhy = translations[lang]['explain.why_prediction'];
      const expectedMainFactors = translations[lang]['explain.main_factors'];
      const expectedSupporting = translations[lang]['explain.supporting'];
      const expectedLowering = translations[lang]['explain.lowering'];

      await expect(page.locator(`text=${expectedWhy}`).first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator(`text=${expectedMainFactors}`).first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator(`text=${expectedSupporting}`).first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator(`text=${expectedLowering}`).first()).toBeVisible({ timeout: 5000 });

      // 5. Verify Recommended Management Action
      const expectedAction = translations[lang]['explain.recommended_action'];
      await expect(page.locator(`text=${expectedAction}`).first()).toBeVisible({ timeout: 5000 });

      // 6. Verify Technical Explanation Collapsible Trigger
      const expectedTech = translations[lang]['explain.tech_exp'];
      const expectedAdv = translations[lang]['explain.advanced_detail'];
      await expect(page.locator(`text=${expectedTech}`).first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator(`text=${expectedAdv}`).first()).toBeVisible({ timeout: 5000 });
    }
  });

  // 4. Verify Specifically Kannada, Punjabi, Marathi Strings Mentioned in User Request
  // 4. Detailed Kannada, Marathi, Punjabi verification
  test('verify exact Kannada, Marathi, Punjabi localized strings in Explainability view', async ({ page }) => {
    await page.goto('http://localhost:3000/explainability');
    await page.waitForTimeout(1000);

    // Test Kannada view
    await selectLanguage(page, 'kn');

    // “Cow Local (SHAP)” -> "ಹಸು ಸ್ಥಳೀಯ (SHAP)"
    await expect(page.locator('button:has-text("ಹಸು ಸ್ಥಳೀಯ (SHAP)")').first()).toBeVisible();
    // “Model Architecture” -> "ಮಾದರಿ ವಾಸ್ತುಶಿಲ್ಪ"
    await expect(page.locator('button:has-text("ಮಾದರಿ ವಾಸ್ತುಶಿಲ್ಪ")').first()).toBeVisible();
    // “PREDICTION HISTORY” -> "ಮುನ್ಸೂಚನೆ ಇತಿಹಾಸ"
    await expect(page.locator('text=ಮುನ್ಸೂಚನೆ ಇತಿಹಾಸ').first()).toBeVisible();
    // “Showing history for” -> "ಇತಿಹಾಸವನ್ನು ತೋರಿಸಲಾಗುತ್ತಿದೆ:"
    await expect(page.locator('text=ಇತಿಹಾಸವನ್ನು ತೋರಿಸಲಾಗುತ್ತಿದೆ:').first()).toBeVisible();
    // “PREDICTED YIELD” -> "ಅಂದಾಜು ಇಳುವರಿ"
    await expect(page.locator('text=ಅಂದಾಜು ಇಳುವರಿ').first()).toBeVisible();
    // “Selected Explanation” -> "ಆಯ್ಕೆಮಾಡಿದ ವಿವರಣೆ"
    await expect(page.locator('text=ಆಯ್ಕೆಮಾಡಿದ ವಿವರಣೆ').first()).toBeVisible();
    // "High Confidence" -> "ಹೆಚ್ಚಿನ ವಿಶ್ವಾಸಾರ್ಹತೆ"
    await expect(page.locator('text=ಹೆಚ್ಚಿನ ವಿಶ್ವಾಸಾರ್ಹತೆ').first()).toBeVisible();

    // Test Marathi view
    await selectLanguage(page, 'mr');
    await expect(page.locator('button:has-text("गाय स्थानिक (SHAP)")').first()).toBeVisible();
    await expect(page.locator('button:has-text("मॉडेल आर्किटेक्चर")').first()).toBeVisible();
    await expect(page.locator('text=अनुमान इतिहास').first()).toBeVisible();
    await expect(page.locator('text=अंदाजित उत्पादन').first()).toBeVisible();
    await expect(page.locator('text=निवडलेले स्पष्टीकरण').first()).toBeVisible();

    // Test Punjabi view
    await selectLanguage(page, 'pa');
    await expect(page.locator('button:has-text("ਗਾਂ ਸਥਾਨਕ (SHAP)")').first()).toBeVisible();
    await expect(page.locator('button:has-text("ਮਾਡਲ ਆਰਕੀਟੈਕਚਰ")').first()).toBeVisible();
    await expect(page.locator('text=ਅਨੁਮਾਨ ਇਤਿਹਾਸ').first()).toBeVisible();
    await expect(page.locator('text=ਅਨੁਮਾਨਿਤ ਪੈਦਾਵਾਰ').first()).toBeVisible();
    await expect(page.locator('text=ਚੁਣੀ ਹੋਈ ਵਿਆਖਿਆ').first()).toBeVisible();
  });

  // 5. Verify Model Architecture Tab & Technical Waterfall in non-English languages
  test('should render Model Architecture tab and technical waterfall in non-English languages', async ({ page }) => {
    await page.goto('http://localhost:3000/explainability');
    await page.waitForTimeout(1000);

    // Open technical waterfall in local tab
    const techExpBtn = page.locator('button:has-text("Technical Explanation")').or(
      page.locator('button:has-text("SHAP")')
    ).last();
    if (await techExpBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await techExpBtn.click();
      await page.waitForTimeout(300);
    }

    // Switch to Kannada
    await selectLanguage(page, 'kn');

    // Switch to Model Architecture Tab
    const archBtn = page.locator('button:has-text("ಮಾದರಿ ವಾಸ್ತುಶಿಲ್ಪ")').first();
    await expect(archBtn).toBeVisible({ timeout: 5000 });
    await archBtn.click();
    await page.waitForTimeout(500);

    // Verify Model Architecture localized strings
    // "Monotonicity Guaranteed" -> "ಮೊನೊಟೋನಿಸಿಟಿ ಖಾತರಿಪಡಿಸಲಾಗಿದೆ"
    await expect(page.locator('text=ಮೊನೊಟೋನಿಸಿಟಿ ಖಾತರಿಪಡಿಸಲಾಗಿದೆ').first()).toBeVisible();
    // "Monotonic Violations" -> "ಮೊನೊಟೋನಿಕ್ ಉಲ್ಲಂಘನೆಗಳು"
    await expect(page.locator('text=ಮೊನೊಟೋನಿಕ್ ಉಲ್ಲಂಘನೆಗಳು').first()).toBeVisible();
    // "Best CV R²" -> "ಅತ್ಯುತ್ತಮ CV R²"
    await expect(page.locator('text=ಅತ್ಯುತ್ತಮ CV R²').first()).toBeVisible();
    // "Physics Bound" -> "ಭೌತಶಾಸ್ತ್ರ ಬದ್ಧ"
    await expect(page.locator('text=ಭೌತಶಾಸ್ತ್ರ ಬದ್ಧ').first()).toBeVisible();
    // "Global Feature Importance (SHAP)" -> "ಜಾಗತಿಕ ವೈಶಿಷ್ಟ್ಯ ಪ್ರಾಮುಖ್ಯತೆ (SHAP)"
    await expect(page.locator('text=ಜಾಗತಿಕ ವೈಶಿಷ್ಟ್ಯ ಪ್ರಾಮುಖ್ಯತೆ (SHAP)').first()).toBeVisible();
    // "Top Predictors" -> "ಪ್ರಮುಖ ಮುನ್ಸೂಚಕರು"
    await expect(page.locator('text=ಪ್ರಮುಖ ಮುನ್ಸೂಚಕರು').first()).toBeVisible();
    // "Benchmark Leaderboard" -> "ಮಾನದಂಡ ಲೀಡರ್‌ಬೋರ್ಡ್"
    await expect(page.locator('text=ಮಾನದಂಡ ಲೀಡರ್‌ಬೋರ್ಡ್').first()).toBeVisible();
    // "XGBoost Winner" -> "XGBoost ವಿಜೇತ"
    await expect(page.locator('text=XGBoost ವಿಜೇತ').first()).toBeVisible();
    // "Why Monotonicity Matters in Dairy Analytics" -> "ಡೈರಿ ವಿಶ್ಲೇಷಣೆಯಲ್ಲಿ ಮೊನೊಟೋನಿಸಿಟಿ ಏಕೆ ಮುಖ್ಯವಾಗಿದೆ"
    await expect(page.locator('text=ಡೈರಿ ವಿಶ್ಲೇಷಣೆಯಲ್ಲಿ ಮೊನೊಟೋನಿಸಿಟಿ ಏಕೆ ಮುಖ್ಯವಾಗಿದೆ').first()).toBeVisible();
  });
});
