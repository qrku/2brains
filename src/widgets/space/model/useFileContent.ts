'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { spaceReadContent, spaceSaveContent, type SpaceNode } from '@/entities/space';
import { htmlToMarkdown } from '@/shared/lib/htmlToMarkdown';

type Mode = 'md' | 'visual';

interface UseFileContentOptions {
  openFileId: string | null;
  workspaceId: string;
  nodes: SpaceNode[];
  mode: Mode;
  visualRef: React.RefObject<HTMLDivElement | null>;
  /** Вызывается синхронно при переключении на новый файл (например, закрыть меню «/»). */
  onFileSwitch: () => void;
}

/**
 * Загрузка/сохранение содержимого текущего файла: чтение при открытии, досохранение
 * предыдущего файла при переключении, debounce-автосейв на ввод и flush при размонтировании.
 */
export function useFileContent({
  openFileId,
  workspaceId,
  nodes,
  mode,
  visualRef,
  onFileSwitch,
}: UseFileContentOptions) {
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(true);
  // Increments every time a different file is opened — used to trigger visual refresh
  const [fileKey, setFileKey] = useState(0);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Содержимое, ожидающее записи по таймеру автосейва — досохраняется при размонтировании. */
  const pendingContent = useRef<string | null>(null);
  const currentFileId = useRef<string | null>(null);
  // The workspace the currently-loaded file belongs to — kept separate from
  // workspaceId so a flush-on-switch always writes back to the right workspace.
  const currentFileWsId = useRef<string>(workspaceId);
  // Always-current ref so the file-load effect can read mode without a stale closure
  const modeRef = useRef<Mode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  });

  // Дерево, каким оно было на последнем рендере: flush'ам нужно проверить, что файл
  // ещё существует, а они срабатывают из эффектов, где замыкание уже устарело бы.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  /** Файл удалили — писать его содержимое обратно нельзя, ключ создастся заново. */
  const fileStillExists = useCallback(
    (id: string) => nodesRef.current.some((n) => n.id === id),
    [],
  );

  /* ── Load file ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!openFileId) return;
    if (currentFileId.current === openFileId) return;

    // Flush pending save for the previous file — write it back to the workspace it belongs to
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (currentFileId.current && fileStillExists(currentFileId.current)) {
      // In visual mode the source of truth is the div's innerHTML, not React state
      const toSave =
        modeRef.current === 'visual' && visualRef.current
          ? htmlToMarkdown(visualRef.current.innerHTML)
          : content;
      spaceSaveContent(currentFileId.current, toSave, currentFileWsId.current);
    }
    // Отложенная запись уже выполнена (или относилась к другому файлу) — иначе
    // flush при размонтировании положил бы содержимое прошлого файла в новый.
    pendingContent.current = null;

    currentFileId.current = openFileId;
    currentFileWsId.current = workspaceId;
    setContent(spaceReadContent(openFileId, workspaceId));
    setSaved(true);
    onFileSwitch();
    setFileKey((k) => k + 1); // signal visual effect to re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFileId, workspaceId]);

  /* ── Persist helper ────────────────────────────────────────────────── */
  const persist = useCallback(
    (val: string) => {
      setSaved(false);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      pendingContent.current = val;
      saveTimer.current = setTimeout(() => {
        const id = currentFileId.current;
        // Файл мог быть удалён за время дебаунса — тогда запись создала бы ключ заново.
        if (id && fileStillExists(id)) {
          spaceSaveContent(id, val, currentFileWsId.current);
          setSaved(true);
        }
        pendingContent.current = null;
      }, 600);
    },
    [fileStillExists],
  );

  /* ── Flush on unmount ──────────────────────────────────────────────────
   * Таймер автосейва живёт 600 мс; без досохранения уход со страницы (или
   * размонтирование редактора) просто терял последние правки вместе с таймером.
   * `fileStillExists` намеренно не в зависимостях: эффект должен сработать ровно один
   * раз, на размонтировании. С ним cleanup перезапускался бы на каждое изменение
   * колбэка и досохранял бы контент посреди жизни компонента. */
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const pending = pendingContent.current;
      const id = currentFileId.current;
      if (pending !== null && id && fileStillExists(id)) {
        spaceSaveContent(id, pending, currentFileWsId.current);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { content, setContent, saved, persist, fileKey };
}
