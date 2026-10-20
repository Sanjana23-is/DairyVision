import { test, expect } from '@playwright/test';

test.describe('Supabase Password Recovery Flow', () => {
  test('1. Normal login and forgot-password pages render without interference', async ({ page }) => {
    // Normal /login visit
    await page.goto('http://localhost:3000/login');
    await expect(page.locator('h2:has-text("Sign in to your account")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('text=Forgot password?')).toBeVisible();

    // Normal /forgot-password visit
    await page.click('text=Forgot password?');
    await page.waitForURL('**/forgot-password');
    await expect(page.locator('h2:has-text("Reset your password")')).toBeVisible();
  });

  test('2. Successful recovery navigation from root/site URL forwards to /reset-password and scrubs token from URL', async ({ page }) => {
    // Simulate Supabase redirecting to Site URL with recovery token in hash fragment
    const mockToken = 'mock.supabase.recovery.token.xyz';
    await page.goto(`http://localhost:3000/#access_token=${mockToken}&type=recovery`);

    // Verify redirected to /reset-password
    await page.waitForURL('**/reset-password**', { timeout: 10000 });
    await expect(page.locator('h2:has-text("Set a new password")')).toBeVisible({ timeout: 10000 });

    // Verify token was immediately scrubbed from browser address bar
    const currentUrl = page.url();
    expect(currentUrl).not.toContain(mockToken);
    expect(currentUrl).not.toContain('access_token=');
  });

  test('3. Expired or invalid recovery link shows user-friendly error and recovery CTA', async ({ page }) => {
    // Simulate Supabase returning expired OTP error in URL hash
    await page.goto('http://localhost:3000/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');

    // Verify redirected to /reset-password and displays clear error card
    await page.waitForURL('**/reset-password**', { timeout: 10000 });
    await expect(page.locator('h2:has-text("Invalid recovery link")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Email link is invalid or has expired')).toBeVisible();

    // Verify button to request a new link works
    await page.click('button:has-text("Request a new reset link")');
    await page.waitForURL('**/forgot-password');
    await expect(page.locator('h2:has-text("Reset your password")')).toBeVisible();
  });

  test('4. Password validation: rejects mismatched and short passwords', async ({ page }) => {
    const mockToken = 'mock.supabase.recovery.token.validation';
    await page.goto(`http://localhost:3000/reset-password#access_token=${mockToken}&type=recovery`);
    await expect(page.locator('h2:has-text("Set a new password")')).toBeVisible({ timeout: 10000 });

    // 1. Password too short (< 8 chars)
    await page.fill('input#password', '123');
    await page.fill('input#confirmPassword', '123');
    await page.click('button:has-text("Update password")');
    await expect(page.locator('text=Password must be at least 8 characters long')).toBeVisible();

    // 2. Passwords do not match
    await page.fill('input#password', 'ValidPassword123!');
    await page.fill('input#confirmPassword', 'DifferentPassword456!');
    await page.click('button:has-text("Update password")');
    await expect(page.locator('text=Passwords do not match')).toBeVisible();
  });

  test('5. Successful password update shows confirmation and sign-in button', async ({ page }) => {
    // Intercept backend API call to return success
    await page.route('**/api/v1/auth/reset-password', async (route) => {
      // Assert that Authorization header was sent with Bearer token
      const headers = route.request().headers();
      expect(headers['authorization']).toBe('Bearer mock.supabase.recovery.token.success');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Password has been successfully updated.' }),
      });
    });

    const mockToken = 'mock.supabase.recovery.token.success';
    await page.goto(`http://localhost:3000/reset-password#access_token=${mockToken}&type=recovery`);
    await expect(page.locator('h2:has-text("Set a new password")')).toBeVisible({ timeout: 10000 });

    await page.fill('input#password', 'NewSecurePassword2026!');
    await page.fill('input#confirmPassword', 'NewSecurePassword2026!');
    await page.click('button:has-text("Update password")');

    // Verify success card appears
    await expect(page.locator('h2:has-text("You\'re all set!")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Sign in to DairyVision")')).toBeVisible();

    // Click Sign in button and verify navigation to /login
    await page.click('button:has-text("Sign in to DairyVision")');
    await page.waitForURL('**/login');
  });

  test('6. Backend 401 error displays expired link error gracefully', async ({ page }) => {
    // Intercept backend API call to return 401
    await page.route('**/api/v1/auth/reset-password', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'The recovery token is invalid or has expired.' }),
      });
    });

    const mockToken = 'mock.supabase.recovery.token.expired';
    await page.goto(`http://localhost:3000/reset-password#access_token=${mockToken}&type=recovery`);
    await expect(page.locator('h2:has-text("Set a new password")')).toBeVisible({ timeout: 10000 });

    await page.fill('input#password', 'NewSecurePassword2026!');
    await page.fill('input#confirmPassword', 'NewSecurePassword2026!');
    await page.click('button:has-text("Update password")');

    // Verify transitions to expired link state
    await expect(page.locator('h2:has-text("Invalid recovery link")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=This password reset link is invalid or has expired')).toBeVisible();
  });
});
