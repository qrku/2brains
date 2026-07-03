import type { CustomPage } from './types';

const KEY = 'constructor_pages_v1';

export function loadPages(): CustomPage[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
export function savePages(pages: CustomPage[]) {
  try { localStorage.setItem(KEY, JSON.stringify(pages)); } catch {}
}
export function loadPage(id: string): CustomPage | null {
  return loadPages().find((p) => p.id === id) ?? null;
}
export function savePage(page: CustomPage) {
  const pages = loadPages();
  const i = pages.findIndex((p) => p.id === page.id);
  if (i >= 0) pages[i] = page; else pages.push(page);
  savePages(pages);
}
export function deletePage(id: string) {
  savePages(loadPages().filter((p) => p.id !== id));
}
