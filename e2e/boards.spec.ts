import { test, expect, type Page } from '@playwright/test';

// Boards live entirely in localStorage, so these run against `next dev` with no backend.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('auth_v1', 'e2e@test.dev'));
});

/** Double-click on empty canvas — the board's own gesture for "add a block here". */
async function addNode(page: Page, x: number, y: number) {
  const before = await page.locator('.board-node').count();
  await page.locator('.board-vp').dblclick({ position: { x, y } });
  await expect(page.locator('.board-node')).toHaveCount(before + 1);
  // Blur the block that opens in edit mode, then let the debounced save land.
  await page.keyboard.press('Escape');
  // The 600 ms autosave debounce writes to localStorage and paints nothing, so there is no
  // locator to await — a fixed wait past the debounce is the only signal available here.
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(700);
}

const openMenu = (page: Page) => page.locator('.board-switch-trigger').click();

test.describe('boards', () => {
  test('starts with a single board named Доска', async ({ page }) => {
    await page.goto('/board');
    await expect(page.locator('.board-switch-trigger')).toHaveText(/Доска/);

    await openMenu(page);
    await expect(page.locator('.board-switch-item')).toHaveCount(1);
    // The only board can't be deleted — there'd be nothing left to draw on.
    await expect(page.locator('.board-switch-item .board-switch-act')).toHaveCount(1);
  });

  test('a new board is empty and does not disturb the first one', async ({ page }) => {
    await page.goto('/board');
    await addNode(page, 300, 200);
    await expect(page.locator('.board-node')).toHaveCount(1);

    await openMenu(page);
    await page.locator('.board-switch-add').click();

    await expect(page.locator('.board-switch-trigger')).toHaveText(/Доска 2/);
    await expect(page.locator('.board-node')).toHaveCount(0);

    await addNode(page, 500, 300);
    await addNode(page, 600, 400);
    await expect(page.locator('.board-node')).toHaveCount(2);

    // Back to the first board: its single block is still there.
    await openMenu(page);
    await page.locator('.board-switch-pick', { hasText: /^Доска$/ }).click();
    await expect(page.locator('.board-switch-trigger')).toHaveText(/^Доска/);
    await expect(page.locator('.board-node')).toHaveCount(1);

    // Each board owns its own document key.
    const keys = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith('board_data_v1')),
    );
    expect(keys).toHaveLength(2);
  });

  test('the open board survives a reload', async ({ page }) => {
    await page.goto('/board');
    await openMenu(page);
    await page.locator('.board-switch-add').click();
    await addNode(page, 420, 260);

    await page.reload();
    await expect(page.locator('.board-switch-trigger')).toHaveText(/Доска 2/);
    await expect(page.locator('.board-node')).toHaveCount(1);
  });

  test('renames and deletes a board', async ({ page }) => {
    await page.goto('/board');
    await openMenu(page);
    await page.locator('.board-switch-add').click();

    await openMenu(page);
    await page.locator('.board-switch-item.active .board-switch-act').first().click();
    await page.locator('.board-switch-input').fill('Архитектура');
    await page.keyboard.press('Enter');
    await expect(page.locator('.board-switch-trigger')).toHaveText(/Архитектура/);

    // The menu stays open through a rename, so the delete button is right there.
    page.once('dialog', (d) => d.accept());
    await page.locator('.board-switch-item.active .board-switch-act').nth(1).click();

    await expect(page.locator('.board-switch-trigger')).toHaveText(/^Доска/);
    await expect(page.locator('.board-switch-item')).toHaveCount(1);
  });
});
