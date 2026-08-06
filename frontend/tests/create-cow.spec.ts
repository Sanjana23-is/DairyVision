import { test, expect } from '@playwright/test';

test('create cow posts normalized payload', async ({ page }) => {
  // pre-set localStorage so the app believes user is authenticated and has a current farm
  await page.addInitScript(() => {
    localStorage.setItem('dairyvision_access_token', 'fake-token');
    localStorage.setItem('dairyvision_user', JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', email: 'test@example.com', full_name: 'Test User' }));
    localStorage.setItem('current_farm_id', '00000000-0000-0000-0000-000000000010');
    localStorage.setItem('current_farm_name', 'Demo Farm');
  });

  let intercepted: any = null;

  await page.route('**/api/v1/cows', async (route) => {
    const req = route.request();
    try {
      intercepted = req.postDataJSON();
    } catch (e) {
      intercepted = null;
    }
    // return a successful created response
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ...intercepted,
        id: 'mock-id',
        created_by: '00000000-0000-0000-0000-000000000001',
        owner_id: '00000000-0000-0000-0000-000000000001',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
  });

  // navigate to the cows page (dev server runs on port 3000)
  await page.goto('http://localhost:3000/cows');

  // open Add Cow dialog
  await page.click('text=Add Cow');

  // fill the form fields
  await page.fill('input[name="name"]', 'luna');
  await page.fill('input[name="tag"]', 'TAG1');
  await page.fill('input[name="breed"]', 'hostiel');
  await page.selectOption('select[name="status"]', 'active');

  // submit
  await page.click('text=Create');

  // wait for the route to have been called
  await page.waitForTimeout(500);

  // assertions
  expect(intercepted).not.toBeNull();
  expect(intercepted).toHaveProperty('tag_id');
  expect(intercepted.tag_id).toBe('TAG1');
  expect(intercepted).toHaveProperty('breed_id');
  expect(intercepted.breed_id).toBe('hostiel');
});
