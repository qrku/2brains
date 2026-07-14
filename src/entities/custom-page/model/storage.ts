import type { CustomPage } from './types';
import { wsKey } from '@/shared/lib/workspace';

const KEY = 'constructor_pages_v1';

export function loadPages(workspaceId: string): CustomPage[] {
  try { return JSON.parse(localStorage.getItem(wsKey(KEY, workspaceId)) ?? '[]'); } catch { return []; }
}
export function savePages(pages: CustomPage[], workspaceId: string) {
  try { localStorage.setItem(wsKey(KEY, workspaceId), JSON.stringify(pages)); } catch {}
}
export function loadPage(id: string, workspaceId: string): CustomPage | null {
  return loadPages(workspaceId).find((p) => p.id === id) ?? null;
}
export function savePage(page: CustomPage, workspaceId: string) {
  const pages = loadPages(workspaceId);
  const i = pages.findIndex((p) => p.id === page.id);
  if (i >= 0) pages[i] = page; else pages.push(page);
  savePages(pages, workspaceId);
}
export function deletePage(id: string, workspaceId: string) {
  savePages(loadPages(workspaceId).filter((p) => p.id !== id), workspaceId);
}
