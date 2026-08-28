'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { spaceReadContent, spaceSaveContent, type SpaceNode } from '@/entities/space';

interface UseFileContentOptions {
  fileId: string | null;
  workspaceId: string;
  nodes: SpaceNode[];
}

/**
 * Загрузка/сохранение содержимого текущего файла: чтение при открытии, досохранение
 * предыдущего файла при переключении, debounce-автосейв на ввод и flush при размонтировании.
 *
 * Источник правды — сам markdown-текст: редактор хранит документ ровно в том виде,
 * в каком он лежит на диске, поэтому досохранять здесь нечего пересобирать.
 */
export function useFileContent({ fileId, workspaceId, nodes }: UseFileContentOptions) {
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(true);
  // Increments every time a different file is opened — the editor watches it to swap its document
  const [fileKey, setFileKey] = useState(0);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Содержимое, ожидающее записи по таймеру автосейва — досохраняется при размонтировании. */
  const pendingContent = useRef<string | null>(null);
  const currentFileId = useRef<string | null>(null);
  // The workspace the currently-loaded file belongs to — kept separate from
  // workspaceId so a flush-on-switch always writes back to the right workspace.
  const currentFileWsId = useRef<string>(workspaceId);
  /** Последний известный текст: эффект переключения читает его без устаревшего замыкания. */
  const contentRef = useRef('');
  contentRef.current = content;

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
    if (!fileId) return;
    if (currentFileId.current === fileId) return;

    // Flush pending save for the previous file — write it back to the workspace it belongs to
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (currentFileId.current && fileStillExists(currentFileId.current)) {
      spaceSaveContent(currentFileId.current, contentRef.current, currentFileWsId.current);
    }
    // Отложенная запись уже выполнена (или относилась к другому файлу) — иначе
    // flush при размонтировании положил бы содержимое прошлого файла в новый.
    pendingContent.current = null;

    currentFileId.current = fileId;
    currentFileWsId.current = workspaceId;
    const text = spaceReadContent(fileId, workspaceId);
    contentRef.current = text;
    setContent(text);
    setSaved(true);
    setFileKey((k) => k + 1); // signal the editor to swap its document
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, workspaceId]);

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

  return { content, contentRef, setContent, saved, persist, fileKey };
}
