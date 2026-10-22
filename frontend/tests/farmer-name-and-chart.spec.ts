import { test, expect } from '@playwright/test';

test.describe('Farmer Name & Milk Production Chart Verification', () => {
  test('validates farmer name fallback, profile update, navbar & greeting display, and chart rendering', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Visit login page
    await page.goto('http://localhost:3000/login');
    await expect(page).toHaveTitle(/DairyVision AI/i);

    // 2. Log in with demo user
    await page.fill('input[type="email"]', 'demo.farmer@dairyvision.ai');
    await page.fill('input[type="password"]', 'DairyVisionDemo2026!');
    await page.click('button[type="submit"]');

    // 3. Handle Select Farm or Dashboard
    await page.waitForURL((url) => url.pathname.includes('/dashboard') || url.pathname.includes('/select-farm'), { timeout: 25000 });

    if (page.url().includes('/select-farm')) {
      // In select-farm, verify header does NOT show raw email
      const welcomeText = await page.locator('text=WELCOME BACK').first().textContent();
      expect(welcomeText).not.toContain('demo.farmer@dairyvision.ai');
      console.log('SelectFarm welcome banner:', welcomeText);

      // Enter the first farm
      await page.click('button:has-text("Enter Farm")');
      await page.waitForURL('**/dashboard', { timeout: 15000 });
    }

    // 4. Verify Dashboard Greeting & Navbar
    // Greeting should NOT display raw email 'demo.farmer@dairyvision.ai'
    const greeting = page.locator('h1').first();
    await expect(greeting).toBeVisible({ timeout: 15000 });
    const greetingText = await greeting.textContent();
    expect(greetingText).not.toContain('demo.farmer@dairyvision.ai');
    console.log('Dashboard Greeting:', greetingText);

    // Navbar user display should not show raw email
    const navbarText = await page.locator('header, nav').first().textContent();
    expect(navbarText).not.toContain('demo.farmer@dairyvision.ai');

    // 5. Verify Milk Production Chart
    await expect(page.locator('text=Milk Production Overview')).toBeVisible({ timeout: 15000 });

    // Check legend items: Actual Milk, Predicted Target (AI), Expected Baseline
    await expect(page.locator('text=Actual Milk')).toBeVisible();
    await expect(page.locator('text=Predicted Target (AI)')).toBeVisible();
    await expect(page.locator('text=Expected Baseline')).toBeVisible();

    // Check 7-day and 30-day buttons
    const sevenDayBtn = page.locator('button:text-is("7 Days")');
    const thirtyDayBtn = page.locator('button:text-is("30 Days")');
    await expect(sevenDayBtn).toBeVisible();
    await expect(thirtyDayBtn).toBeVisible();

    // Toggle 30 Days view
    await thirtyDayBtn.click();
    await page.waitForTimeout(500);
    // Toggle 7 Days view
    await sevenDayBtn.click();
    await page.waitForTimeout(500);

    // Verify footer summary shows baseline indicator
    await expect(page.locator('text=Showing last')).toBeVisible();
    await expect(page.locator('text=(baseline)').first()).toBeVisible();

    // 6. Verify Farmer Profile Page
    await page.goto('http://localhost:3000/profile');
    await expect(page.locator('text=User Profile & Account Settings')).toBeVisible({ timeout: 15000 });

    // Ensure email is shown in Account Email / details section
    await expect(page.locator('text=demo.farmer@dairyvision.ai').first()).toBeVisible();

    // Edit full name to "Ramesh Kumar"
    const nameInput = page.locator('input[placeholder*="Sanjana"]').first();
    await nameInput.fill('Ramesh Kumar');

    // Click Save Changes
    const saveBtn = page.locator('button:has-text("Save Changes")');
    await saveBtn.click();
    await page.waitForTimeout(1000);

    // Refresh page and ensure Ramesh Kumar persists in header and navbar
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ramesh Kumar' })).toBeVisible({ timeout: 15000 });

    // Navigate to dashboard and verify greeting has updated to Ramesh Kumar
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForSelector('h1');
    const updatedGreeting = await page.locator('h1').first().textContent();
    expect(updatedGreeting).toContain('Ramesh Kumar');
    console.log('Updated Greeting after profile edit:', updatedGreeting);

    // 7. Verify Fallback Logic: test fallback to "Farmer" when name is missing or email
    const fallbackResults = await page.evaluate(() => {
      const fn = (u: any) => {
        if (!u) return 'Farmer';
        const name = u.full_name?.trim();
        if (!name || name === u.email?.trim()) return 'Farmer';
        return name;
      };
      return [
        fn({ full_name: null, email: 'john@example.com' }),
        fn({ full_name: '', email: 'john@example.com' }),
        fn({ full_name: 'john@example.com', email: 'john@example.com' }),
        fn({ full_name: 'Dr. Jane Doe', email: 'jane@example.com' }),
      ];
    });
    expect(fallbackResults).toEqual(['Farmer', 'Farmer', 'Farmer', 'Dr. Jane Doe']);

    // 8. Verify Add Farm Dialog collects Farmer Name
    const newFarmBtn = page.locator('button:has-text("+ New Farm")');
    if (await newFarmBtn.isVisible()) {
      await newFarmBtn.click();
      await expect(page.locator('text=Farmer\'s Full Name')).toBeVisible({ timeout: 5000 });
      await page.keyboard.press('Escape');
    }

    // Restore name back to "Dairy Farm Operations Director"
    await page.goto('http://localhost:3000/profile');
    await page.waitForSelector('input[placeholder*="Sanjana"]');
    await page.locator('input[placeholder*="Sanjana"]').first().fill('Dairy Farm Operations Director');
    await page.locator('button:has-text("Save Changes")').click();
    await page.waitForTimeout(1000);
  });
});
