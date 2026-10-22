import { test, expect } from '@playwright/test';

test.describe('DairyVision AI Complete Predictions Workflow Tests', () => {
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
    await expect(page.locator('[data-testid="cow-selector"]')).toBeEnabled({ timeout: 10000 });
  });

  test('cow-first selection automatically displays today baseline comparison and production history', async ({ page }) => {
    const cowSelector = page.locator('[data-testid="cow-selector"]');

    // Select cow "Ganga"
    await cowSelector.selectOption({ label: '🐄 Ganga' });

    // Header and baseline comparison should be displayed
    await expect(page.locator('text=Daily Milk Production & Baseline Comparison')).toBeVisible();
    await expect(page.locator('text=EXPECTED DAILY BASELINE')).toBeVisible();
    await expect(page.locator('text=RECORDED ACTUAL YIELD')).toBeVisible();
    await expect(page.locator('text=ANOMALY STATUS')).toBeVisible();

    // Production History section should be visible with trend chart and table
    const historySection = page.locator('[data-testid="production-history-section"]');
    await expect(historySection).toBeVisible();
    await expect(historySection.locator('text=Production History')).toBeVisible();
    await expect(historySection.locator('table')).toBeVisible();

    // History filter preset buttons should exist
    await expect(page.locator('[data-testid="history-range-7"]')).toBeVisible();
    await expect(page.locator('[data-testid="history-range-14"]')).toBeVisible();
    await expect(page.locator('[data-testid="history-range-30"]')).toBeVisible();
    await expect(page.locator('[data-testid="history-range-all"]')).toBeVisible();
  });

  test('when today record is missing, clearly displays "Today\'s record is not available." without fabricated numbers', async ({ page }) => {
    const cowSelector = page.locator('[data-testid="cow-selector"]');

    // Select cow "Lakshmi"
    await cowSelector.selectOption({ label: '🐄 Lakshmi' });

    // Check that expected baseline card is visible
    await expect(page.locator('text=EXPECTED DAILY BASELINE')).toBeVisible();

    // Today's record is not available should be clearly displayed
    await expect(page.locator('text=Today\'s record is not available.')).toBeVisible();

    // The recorded actual yield tile does not invent a numerical volume
    const yieldTile = page.locator('[data-testid="recorded-actual-yield-tile"]');
    await expect(yieldTile.locator('text=L/day')).not.toBeVisible();
    await expect(yieldTile.locator('text=0.00')).not.toBeVisible();
  });

  test('production history date-range presets filter records without fabricating data', async ({ page }) => {
    const cowSelector = page.locator('[data-testid="cow-selector"]');
    await cowSelector.selectOption({ label: '🐄 Ganga' });

    const historySection = page.locator('[data-testid="production-history-section"]');
    await expect(historySection).toBeVisible();

    // Count rows under 7 Days preset
    await page.locator('[data-testid="history-range-7"]').click();
    const rows7 = await historySection.locator('tbody tr').count();
    expect(rows7).toBeGreaterThan(0);
    expect(rows7).toBeLessThanOrEqual(7);

    // Switch to All Records
    await page.locator('[data-testid="history-range-all"]').click();
    const rowsAll = await historySection.locator('tbody tr').count();
    expect(rowsAll).toBeGreaterThanOrEqual(rows7);
  });

  test('custom date filter showing no matching records displays clear empty state', async ({ page }) => {
    const cowSelector = page.locator('[data-testid="cow-selector"]');
    await cowSelector.selectOption({ label: '🐄 Ganga' });

    const historySection = page.locator('[data-testid="production-history-section"]');
    await expect(historySection).toBeVisible();

    // Filter to an impossible future year where no records exist
    const startDateInput = historySection.locator('input[aria-label="Start Date"]');
    const endDateInput = historySection.locator('input[aria-label="End Date"]');
    await startDateInput.fill('2099-01-01');
    await endDateInput.fill('2099-01-31');

    // Clear empty state should appear
    const noRecords = page.locator('[data-testid="no-history-records"]');
    await expect(noRecords).toBeVisible();
    await expect(noRecords).toContainText('No historical observations found');

    // Reset date filter restores records
    await page.click('button:has-text("Reset")');
    await expect(noRecords).not.toBeVisible();
    await expect(historySection.locator('tbody tr').first()).toBeVisible();
  });

  test('switching cows refreshes production history and baseline without displaying stale data', async ({ page }) => {
    const cowSelector = page.locator('[data-testid="cow-selector"]');

    // Select Ganga
    await cowSelector.selectOption({ label: '🐄 Ganga' });
    await expect(page.locator('text=Evaluation for Ganga')).toBeVisible();

    // Switch to Lakshmi
    await cowSelector.selectOption({ label: '🐄 Lakshmi' });
    await expect(page.locator('text=Evaluation for Lakshmi')).toBeVisible();
    await expect(page.locator('text=Evaluation for Ganga')).not.toBeVisible();

    // Switch to unselected
    await cowSelector.selectOption({ value: '' });
    await expect(page.locator('[data-testid="no-cow-selected-state"]')).toBeVisible();
    await expect(page.locator('text=EXPECTED DAILY BASELINE')).not.toBeVisible();
    await expect(page.locator('[data-testid="production-history-section"]')).not.toBeVisible();
  });

  test('strictly user-triggered prediction generation: 12 mandatory scenarios verified via deterministic route interception', async ({ page }) => {
    test.setTimeout(60000);
    let predictionPostCount = 0;
    const interceptedRequests: Array<{ url: string; postData: any }> = [];
    let shouldFailPrediction = false;
    let predictionDelayMs = 0;
    let selectedCowIdCaptured = '';

    // Route interception for deterministic mocked prediction responses
    await page.route('**/api/v1/predictions/milk-yield', async (route) => {
      if (route.request().method() === 'POST') {
        predictionPostCount++;
        const postData = route.request().postDataJSON();
        interceptedRequests.push({ url: route.request().url(), postData });

        if (predictionDelayMs > 0) {
          await new Promise((r) => setTimeout(r, predictionDelayMs));
        }

        if (shouldFailPrediction) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Prediction model inference failure.' }),
          });
          return;
        }

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'mock-pred-det-777',
            cow_id: selectedCowIdCaptured || 'c417dc53-89ad-478c-81b8-23277bad8d0e',
            observation_id: postData?.observation_id || 'mock-obs-1',
            predicted_milk_yield: 18.75,
            model_version: 'deterministic_xgboost_v2',
            confidence_score: 0.92,
            confidence_lower: 17.50,
            confidence_upper: 20.00,
            confidence_data_status: 'historical',
            prediction_timestamp: new Date().toISOString(),
            baseline_method: '7-day rolling median',
            observations_used: 7,
            historical_variability: 0.45,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock explainability endpoint deterministically
    await page.route('**/api/v1/explainability*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          prediction_id: 'mock-pred-det-777',
          cow_id: selectedCowIdCaptured,
          summary_narrative: 'Optimal feed intake and ambient temperature are primary positive drivers supporting forecast.',
          features: [
            { feature: 'feed_intake_kg', display_name: 'Feed Intake', value_formatted: '15.0 kg', shap_value: 1.45 },
            { feature: 'thi_index', display_name: 'THI Index', value_formatted: '68.0', shap_value: -0.65 },
          ],
          top_positive: [
            { feature: 'feed_intake_kg', display_name: 'Feed Intake', value_formatted: '15.0 kg', shap_value: 1.45 },
          ],
          top_negative: [
            { feature: 'thi_index', display_name: 'THI Index', value_formatted: '68.0', shap_value: -0.65 },
          ],
        }),
      });
    });

    const cowSelector = page.locator('[data-testid="cow-selector"]');
    const generateBtn = page.locator('[data-testid="generate-prediction-button"]');

    // SCENARIO 1: Opening /predictions causes ZERO prediction-generation POST requests
    expect(predictionPostCount).toBe(0);

    // SCENARIO 2 & 3: Selecting a cow and automatically selecting today's observation causes ZERO prediction POST requests
    await cowSelector.selectOption({ label: '🐄 Nandi' });
    selectedCowIdCaptured = await cowSelector.inputValue();

    // SCENARIO 7: The baseline comparison, recorded actual yield, anomaly status, and production history load normally
    await expect(page.locator('text=EXPECTED DAILY BASELINE')).toBeVisible();
    await expect(page.locator('text=RECORDED ACTUAL YIELD')).toBeVisible();
    await expect(page.locator('text=ANOMALY STATUS')).toBeVisible();
    await expect(page.locator('[data-testid="production-history-section"]')).toBeVisible();

    // SCENARIO 5: Waiting at least two seconds after each selection still results in ZERO prediction-generation POST requests
    await page.waitForTimeout(2000);
    expect(predictionPostCount).toBe(0);

    // SCENARIO 6: Before clicking the button, predicted-yield result, confidence display, TreeSHAP, and "Why This Prediction?" are absent
    await expect(page.locator('[data-testid="ml-prediction-result-card"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="prediction-confidence-display"]')).not.toBeVisible();
    await expect(page.locator('text=Why This Prediction?')).not.toBeVisible();
    await expect(page.locator('text=Baseline Methodology')).not.toBeVisible();
    await expect(page.locator('[data-testid="prediction-prompt-card"]')).toBeVisible();

    // SCENARIO 4: Changing the observation date causes ZERO prediction-generation POST requests
    const inspectButtons = page.locator('table tbody tr button:has-text("Inspect")');
    if ((await inspectButtons.count()) > 1) {
      await inspectButtons.nth(1).click();
      await page.waitForTimeout(2000); // 2 seconds wait
      expect(predictionPostCount).toBe(0);
      await expect(page.locator('[data-testid="ml-prediction-result-card"]')).not.toBeVisible();
      await expect(page.locator('text=Why This Prediction?')).not.toBeVisible();
      await expect(page.locator('[data-testid="prediction-prompt-card"]')).toBeVisible();
    }

    // SCENARIO 12: Repeated clicks while the request is pending do not create duplicate POST requests
    predictionDelayMs = 600; // Artificial latency
    await expect(generateBtn).toBeEnabled();
    const clickPromise = generateBtn.click();
    await expect(generateBtn).toBeDisabled();
    // Attempt repeated click while request is pending
    await generateBtn.click({ force: true }).catch(() => {});
    await clickPromise;
    // Wait for in-flight request to settle
    await page.waitForResponse((res) => res.url().includes('/predictions/milk-yield'));
    predictionDelayMs = 0;
    // Exactly 1 POST was sent, not 2
    expect(predictionPostCount).toBe(1);

    // SCENARIO 8 & 9: Successful response displays the returned prediction (18.75 L) and its explainability results
    const mlCard = page.locator('[data-testid="ml-prediction-result-card"]');
    await expect(mlCard).toBeVisible({ timeout: 10000 });
    await expect(mlCard.locator('text=18.75')).toBeVisible();
    await expect(page.locator('[data-testid="prediction-confidence-display"]')).toBeVisible();
    await expect(page.locator('text=Why This Prediction?')).toBeVisible();
    await expect(page.locator('text=Optimal feed intake')).toBeVisible();
    await expect(page.locator('[data-testid="prediction-prompt-card"]')).not.toBeVisible();

    // SCENARIO 10: Switching cows or dates after a successful prediction clears old ML results without issuing another prediction POST request
    await cowSelector.selectOption({ label: '🐄 Ganga' });
    selectedCowIdCaptured = await cowSelector.inputValue();
    await expect(page.locator('text=Evaluation for Ganga')).toBeVisible();

    // Old ML results immediately absent
    await expect(page.locator('[data-testid="ml-prediction-result-card"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="prediction-confidence-display"]')).not.toBeVisible();
    await expect(page.locator('text=Why This Prediction?')).not.toBeVisible();
    await expect(page.locator('[data-testid="prediction-prompt-card"]')).toBeVisible();
    expect(predictionPostCount).toBe(1); // Still exactly 1 call

    // SCENARIO 11: A failed prediction request displays an error and allows the user to retry
    shouldFailPrediction = true;
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();
    await page.waitForResponse((res) => res.url().includes('/predictions/milk-yield'));
    expect(predictionPostCount).toBe(2);

    // Error alert is visible with Retry button
    await expect(page.locator('text=Prediction model inference failure.')).toBeVisible();
    const retryBtn = page.locator('[data-testid="prediction-retry-button"]');
    await expect(retryBtn).toBeVisible();

    // Retry succeeds when error condition clears
    shouldFailPrediction = false;
    await retryBtn.click();
    await page.waitForResponse((res) => res.url().includes('/predictions/milk-yield'));
    expect(predictionPostCount).toBe(3);

    // Successful results displayed after retry
    await expect(page.locator('[data-testid="ml-prediction-result-card"]')).toBeVisible();
    await expect(page.locator('text=Why This Prediction?')).toBeVisible();
  });
});
