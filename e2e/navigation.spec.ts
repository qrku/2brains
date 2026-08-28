import { test, expect } from '@playwright/test';

// Start every test already "signed in" so the app shell is available.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('auth_v1', 'e2e@test.dev'));
});

test.describe('core navigation', () => {
  test('moves between Space, Board and Calendar via the nav', async ({ page }) => {
    await page.goto('/space');
    await expect(page).toHaveURL(/\/space/);

    await page.locator('a[href="/board"]').click();
    await expect(page).toHaveURL(/\/board/);
    await expect(page.getByTestId('board-toolbar')).toBeVisible();

    await page.locator('a[href="/calendar"]').click();
    await expect(page).toHaveURL(/\/calendar/);
  });

  test('opening /board directly renders the canvas', async ({ page }) => {
    await page.goto('/board');
    await expect(page.getByTestId('board-toolbar')).toBeVisible();
  });
});
