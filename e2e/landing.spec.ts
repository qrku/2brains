import { test, expect } from '@playwright/test';

// "Auth" is entirely client-side: a valid email is stored in localStorage and the
// user is sent to /space. No backend is involved, so these run against `next dev` alone.
test.describe('landing & auth', () => {
  test('shows the hero and the email form', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Твой второй мозг' })).toBeVisible();
    await expect(page.getByPlaceholder('Электронная почта')).toBeVisible();
    await expect(page.getByRole('button', { name: /Начать/ })).toBeVisible();
  });

  test('rejects an invalid email and stays on the landing', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Электронная почта').fill('not-an-email');
    await page.getByRole('button', { name: /Начать/ }).click();

    await expect(page.getByText('Введи корректную почту')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Твой второй мозг' })).toBeVisible();
  });

  test('a valid email signs in and lands on /space', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Электронная почта').fill('e2e@test.dev');
    await page.getByRole('button', { name: /Начать/ }).click();

    await expect(page).toHaveURL(/\/space/);
    // The app shell (nav) only renders off the landing page — its presence proves we're in.
    await expect(page.locator('a[href="/board"]')).toBeVisible();

    const auth = await page.evaluate(() => localStorage.getItem('auth_v1'));
    expect(auth).toBe('e2e@test.dev');
  });

  test('a returning user skips the landing', async ({ page }) => {
    // Seed auth before any app script runs, then hit the root.
    await page.addInitScript(() => localStorage.setItem('auth_v1', 'e2e@test.dev'));
    await page.goto('/');
    await expect(page).toHaveURL(/\/space/);
  });
});
