import { test, expect, type Page } from '@playwright/test';

// Boards live entirely in localStorage, so these run against `next dev` with no backend.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('auth_v1', 'e2e@test.dev'));
});

// Элементы адресуются через `data-testid`, а не по классам: доска оформлена CSS
// Modules, и настоящие имена классов в разметке хешированы.
const nodes = (page: Page) => page.getByTestId('board-node');
const trigger = (page: Page) => page.getByTestId('board-switch-trigger');
const items = (page: Page) => page.getByTestId('board-switch-item');
// `data-active` стоит на самом элементе, а не на потомке, — поэтому составной
// селектор, а не `.filter({ has })`.
const activeItem = (page: Page) => page.locator('[data-testid="board-switch-item"][data-active]');

/** Double-click on empty canvas — the board's own gesture for "add a block here". */
async function addNode(page: Page, x: number, y: number) {
  const before = await nodes(page).count();
  await page.getByTestId('board-viewport').dblclick({ position: { x, y } });
  await expect(nodes(page)).toHaveCount(before + 1);
  // Blur the block that opens in edit mode, then let the debounced save land.
  await page.keyboard.press('Escape');
  // The 600 ms autosave debounce writes to localStorage and paints nothing, so there is no
  // locator to await — a fixed wait past the debounce is the only signal available here.
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(700);
}

const openMenu = (page: Page) => trigger(page).click();

test.describe('boards', () => {
  test('starts with a single board named Доска', async ({ page }) => {
    await page.goto('/board');
    await expect(trigger(page)).toHaveText(/Доска/);

    await openMenu(page);
    await expect(items(page)).toHaveCount(1);
    // The only board can't be deleted — there'd be nothing left to draw on.
    await expect(page.getByTestId('board-switch-delete')).toHaveCount(0);
    await expect(page.getByTestId('board-switch-rename')).toHaveCount(1);
  });

  test('a new board is empty and does not disturb the first one', async ({ page }) => {
    await page.goto('/board');
    await addNode(page, 300, 200);
    await expect(nodes(page)).toHaveCount(1);

    await openMenu(page);
    await page.getByTestId('board-switch-add').click();

    await expect(trigger(page)).toHaveText(/Доска 2/);
    await expect(nodes(page)).toHaveCount(0);

    await addNode(page, 500, 300);
    await addNode(page, 600, 400);
    await expect(nodes(page)).toHaveCount(2);

    // Back to the first board: its single block is still there.
    await openMenu(page);
    await page
      .getByTestId('board-switch-pick')
      .filter({ hasText: /^Доска$/ })
      .click();
    await expect(trigger(page)).toHaveText(/^Доска/);
    await expect(nodes(page)).toHaveCount(1);

    // Each board owns its own document key.
    const keys = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith('board_data_v1')),
    );
    expect(keys).toHaveLength(2);
  });

  test('the open board survives a reload', async ({ page }) => {
    await page.goto('/board');
    await openMenu(page);
    await page.getByTestId('board-switch-add').click();
    await addNode(page, 420, 260);

    await page.reload();
    await expect(trigger(page)).toHaveText(/Доска 2/);
    await expect(nodes(page)).toHaveCount(1);
  });

  test('renames and deletes a board', async ({ page }) => {
    await page.goto('/board');
    await openMenu(page);
    await page.getByTestId('board-switch-add').click();

    await openMenu(page);
    await activeItem(page).getByTestId('board-switch-rename').click();
    await page.getByTestId('board-switch-input').fill('Архитектура');
    await page.keyboard.press('Enter');
    await expect(trigger(page)).toHaveText(/Архитектура/);

    // The menu stays open through a rename, so the delete button is right there.
    page.once('dialog', (d) => d.accept());
    await activeItem(page).getByTestId('board-switch-delete').click();

    await expect(trigger(page)).toHaveText(/^Доска/);
    await expect(items(page)).toHaveCount(1);
  });
});
