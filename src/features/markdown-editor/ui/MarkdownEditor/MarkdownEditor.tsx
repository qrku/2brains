'use client';

import { useEffect, useRef } from 'react';
import { Annotation, Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { history } from '@codemirror/commands';
import { useSpaceStore } from '@/entities/space';
import { useWorkspaceStore } from '@/entities/workspace';
import { spaceEditorExtensions } from '../../model/cm/setup';
import { usePreviewWidth } from '../../model/usePreviewWidth';
import { useFileContent } from '../../model/useFileContent';
import styles from './MarkdownEditor.module.css';

const PLACEHOLDER = 'Начни вводить... или введи / для вставки блока';

/** Подмена документа при переключении файла — её не нужно сохранять обратно. */
const SwapDocument = Annotation.define<boolean>();

/** История правок живёт в компартменте, чтобы её можно было сбросить на новом файле. */
const historyField = new Compartment();

export interface MarkdownEditorProps {
  /** Файл Пространства, открытый в редакторе; `null` — показать пустое состояние. */
  fileId: string | null;
  /**
   * Собственная панель редактора: имя файла, индикатор сохранения, ширина текста.
   * Панель доски держит свою шапку, поэтому там редактор встраивается без неё.
   */
  toolbar?: boolean;
  /** Что показать вместо редактора, когда файл не выбран. */
  emptyText?: string;
}

/**
 * Редактор markdown поверх файла Пространства.
 *
 * Режим один: markdown-текст с живым превью. Разметка отрисовывается на месте, а
 * под ней остаётся ровно тот текст, что уйдёт на диск — преобразования «HTML →
 * markdown» в этой архитектуре нет, поэтому и терять на нём нечего. Каретка на
 * строке возвращает её исходный вид.
 *
 * Открытый файл приходит пропом, а не берётся из `openFileId` стора: тот же редактор
 * показывает и файл, выбранный в дереве Пространства, и файл ноды, открытый с доски.
 */
export function MarkdownEditor({ fileId, toolbar = true, emptyText }: MarkdownEditorProps) {
  const { state } = useSpaceStore();
  const { nodes } = state;
  const { state: wsState } = useWorkspaceStore();

  const openNode = fileId ? nodes.find((n) => n.id === fileId) : null;
  const hasFile = !!openNode;

  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const { previewWidth, handlePreviewWidthChange } = usePreviewWidth();
  const { contentRef, setContent, saved, persist, fileKey } = useFileContent({
    fileId,
    workspaceId: wsState.currentId,
    nodes,
  });

  // Вью создаётся один раз и переживает ре-рендеры, поэтому обработчик правок
  // берётся через ref: замыкание в расширении устарело бы на первом же рендере.
  const onEdit = useRef<(text: string) => void>(() => {});
  onEdit.current = (text: string) => {
    setContent(text);
    persist(text);
  };

  /* ── Создание редактора ────────────────────────────────────────────── */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const view = new EditorView({
      parent: host,
      doc: contentRef.current,
      extensions: [
        historyField.of(history()),
        ...spaceEditorExtensions(PLACEHOLDER),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          // Смена файла — не правка пользователя: сохранять её обратно нельзя,
          // иначе открытие файла само по себе считалось бы изменением.
          if (update.transactions.some((tr) => tr.annotation(SwapDocument))) return;
          onEdit.current(update.state.doc.toString());
        }),
      ],
    });
    viewRef.current = view;
    // Фокус намеренно не перехватываем: открытый файл показывается отрисованным
    // целиком, а разметка раскрывается только там, где пользователь сам поставил
    // каретку. Заодно не отбираем клавиатуру у дерева файлов.

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // contentRef — стабильная ссылка; пересоздавать вью нужно только на появление
    // или исчезновение открытого файла.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFile]);

  /* ── Переключение файла ────────────────────────────────────────────── */
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const next = contentRef.current;
    if (next === view.state.doc.toString()) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
      selection: { anchor: 0 },
      // Без сброса истории Cmd+Z в новом файле откатывал бы правки предыдущего.
      effects: [historyField.reconfigure(history()), EditorView.scrollIntoView(0)],
      annotations: SwapDocument.of(true),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey]);

  /* ── Пустое состояние ──────────────────────────────────────────────── */
  if (!openNode) {
    return (
      <div className={styles['editor-empty']}>
        <div className={styles['editor-empty-icon']}>◆</div>
        <div className={styles['editor-empty-text']}>
          {emptyText ?? 'Выбери файл или создай новый'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles['editor-wrap']}>
      {toolbar && (
        <div className={styles['editor-toolbar']}>
          <span className={styles['editor-filename']}>{openNode.name}</span>
          <div className={styles['editor-toolbar-right']}>
            {!saved && <span className={styles['editor-saving']}>сохранение...</span>}
            <div className={styles['editor-width-control']} title="Ширина текста">
              <input
                type="range"
                min={40}
                max={100}
                step={5}
                value={previewWidth}
                onChange={(e) => handlePreviewWidthChange(Number(e.target.value))}
              />
              <span className={styles['editor-width-value']}>{previewWidth}%</span>
            </div>
          </div>
        </div>
      )}

      <div
        ref={hostRef}
        className={styles['editor-host']}
        style={{ '--preview-width': `${previewWidth}%` } as React.CSSProperties}
      />
    </div>
  );
}
