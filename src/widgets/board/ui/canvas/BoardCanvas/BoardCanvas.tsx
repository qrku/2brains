'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRegisterTools } from '@/features/ai-agent';
import {
  buildMirrorIndex,
  findFileUsage,
  mirrorNodeFor,
  useBoardSpaceSync,
  useRemoveBoardMirror,
} from '@/features/board-space-sync';
import {
  distToSegment,
  nodesInFrame,
  toC,
  toS,
  type BEdge,
  type BNode,
  type XY,
} from '@/entities/board';
import { useSpaceStore } from '@/entities/space';
import { useWorkspaceStore } from '@/entities/workspace';
import { createBoardTools } from '../../../model/agentTools/agentTools';
import { useBoards } from '../../../model/useBoards';
import { useGestureHint } from '../../../model/useGestureHint';
import { useBoardStore } from '../../../model/useBoardStore';
import { useBoardGeometry, viewportCursor } from '../../../model/geometry/useBoardGeometry';
import { useBoardHotkeys } from '../../../model/hotkeys/useBoardHotkeys';
import { useBoardPinch } from '../../../model/hotkeys/useBoardPinch';
import { useBoardWheel } from '../../../model/hotkeys/useBoardWheel';
import { useDragMachine } from '../../../model/dragging/useDragMachine';
import { useEdgePan } from '../../../model/dragging/useEdgePan';
import { useLongPress, type PressPoint } from '../../../model/dragging/useLongPress';
import { usePointerTracker } from '../../../model/dragging/usePointerTracker';
import { viewportPoint } from '../../../model/dragging/pointer';
import { BoardBottomBar } from '../../toolbar/BoardBottomBar/BoardBottomBar';
import { BoardEdges } from '../BoardEdges/BoardEdges';
import { BoardHint } from '../../BoardHint/BoardHint';
import { BoardNode, type NodeHandlers } from '../BoardNode/BoardNode';
import { BoardSettingsModal } from '../../settings/BoardSettingsModal/BoardSettingsModal';
import { BoardSwitcher } from '../../switcher/BoardSwitcher/BoardSwitcher';
import { BoardToolbar } from '../../toolbar/BoardToolbar/BoardToolbar';
import { FrameWheel } from '../FrameWheel/FrameWheel';
import { GestureHint } from '../../GestureHint/GestureHint';
import { NoteAside, type NoteRef } from '../../NoteAside/NoteAside';
import { PasteModePopup } from '../../paste/PasteModePopup/PasteModePopup';
import { PenPanel } from '../../toolbar/PenPanel/PenPanel';
import {
  EdgeActionBar,
  MultiSelectBar,
  NodePropertyBar,
} from '../../toolbar/PropertyBars/PropertyBars';
import { cx } from '@/shared/lib/cx';
import { useMediaQuery } from '@/shared/lib/useMediaQuery';
import styles from './BoardCanvas.module.css';

export function BoardCanvas() {
  const vpRef = useRef<HTMLDivElement>(null);

  const boards = useBoards();
  const store = useBoardStore(boards.current?.id ?? null);
  const { state, dispatch, stateRef } = store;
  const tracker = usePointerTracker(vpRef);
  const { state: spaceState } = useSpaceStore();
  const { state: wsState } = useWorkspaceStore();

  useDragMachine(store, vpRef);
  useBoardWheel(store, vpRef, tracker);
  useBoardPinch(store, vpRef, tracker);
  useEdgePan(store, vpRef, tracker);

  // Вставка своего же содержимого проходит сразу; чужое сначала спрашивает про режим.
  const [pastePrompt, setPastePrompt] = useState<{ at: XY | null; x: number; y: number } | null>(
    null,
  );
  const onPasteRequested = useCallback(
    (at: XY | null) => {
      const { clipboard, boardId: current, view } = stateRef.current;
      if (!clipboard?.nodes.length) return;

      if (clipboard.boardId === current) {
        dispatch({ type: 'PASTE', at, mode: 'duplicate' });
        return;
      }

      const vp = vpRef.current;
      const pt = at ? toS(at.x, at.y, view) : null;
      setPastePrompt({
        at,
        x: pt?.x ?? (vp?.offsetWidth ?? 0) / 2,
        y: pt?.y ?? (vp?.offsetHeight ?? 0) / 2,
      });
    },
    [dispatch, stateRef],
  );

  const spacePan = useBoardHotkeys(store, tracker, onPasteRequested);

  // Инструменты Доски живут ровно столько, сколько смонтирован холст: они читают состояние
  // через `store.stateRef`, который вне этого компонента перестаёт обновляться.
  useRegisterTools(
    'board',
    useMemo(() => createBoardTools(store), [store]),
  );

  // Каждый блок доски отражается файлом в Пространстве: папка с именем доски, внутри —
  // подпапки фреймов. Хук ведёт дерево за доской, карта ниже отдаёт нодам их файл.
  const boardId = boards.current?.id ?? null;
  useBoardSpaceSync({
    boardId,
    name: boards.current?.name ?? '',
    nodes: state.nodes,
    ready: state.ready,
  });

  // Индекс общий на все доски: связанная копия показывает файл ноды той доски, откуда её взяли.
  const mirrorIndex = useMemo(() => buildMirrorIndex(spaceState.nodes), [spaceState.nodes]);

  // Удалённая доска уносит с собой и своё отражение — но только если её правда удалили:
  // последнюю доску воркспейса `remove` не трогает.
  const removeBoardMirror = useRemoveBoardMirror();
  const boardsWithMirror = useMemo(
    () => ({
      ...boards,
      remove: (id: string) => {
        const removed = boards.remove(id);
        if (removed) removeBoardMirror(id);
        return removed;
      },
    }),
    [boards, removeBoardMirror],
  );

  const geom = useBoardGeometry(state);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [note, setNote] = useState<NoteRef | null>(null);

  /**
   * Блок, которому открыли панель свойств пальцем.
   *
   * На мыши панель показывается на выделение, и отдельного состояния ей не
   * нужно. Пальцем выделяют постоянно — тапом перед переносом или стрелкой, — и
   * панель на каждый такой тап закрывала бы полдоски. Поэтому её вызывают
   * отдельным жестом (долгое нажатие, см. useLongPress), а здесь помнится, для
   * кого именно она открыта.
   */
  const touchUi = useMediaQuery('(pointer: coarse)');
  const [toolsFor, setToolsFor] = useState<string | null>(null);
  const { visible: hintVisible, show: showHint, markGestureLearned } = useGestureHint();

  // Нода, из которой открыта панель: по ней решается, есть ли что отвязывать.
  const noteNode = useMemo(
    () => (note?.nodeId ? (state.nodes.find((n) => n.id === note.nodeId) ?? null) : null),
    [note?.nodeId, state.nodes],
  );

  /**
   * Панель следует за файлом своей ноды.
   *
   * Файл под нодой не вечный: переименование подписи меняет его имя, а отвязка — сам файл.
   * Без этого панель осталась бы на прежнем документе, и правки после отвязки уходили бы в
   * файл оригинала. Зеркало создаёт новый файл не мгновенно, поэтому пока его нет, панель
   * держит прежний и переключается, как только он появится.
   */
  useEffect(() => {
    if (!note?.nodeId) return;
    if (!noteNode) {
      setNote(null);
      return;
    }

    const mirror = mirrorNodeFor(mirrorIndex, boardId, noteNode);
    if (!mirror) return;

    const origin = noteNode.link ?? (boardId ? { boardId, nodeId: noteNode.id } : undefined);
    const same =
      mirror.id === note.id &&
      mirror.name === note.name &&
      origin?.boardId === note.origin?.boardId &&
      origin?.nodeId === note.origin?.nodeId;
    if (same) return;

    setNote({ id: mirror.id, name: mirror.name, origin, nodeId: noteNode.id });
  }, [note, noteNode, mirrorIndex, boardId]);

  // Где ещё используется открытый файл. Считается на открытие панели и на правку досок —
  // обход читает документ каждой доски из localStorage, на каждый рендер это было бы дорого.
  const noteUsage = useMemo(() => {
    if (!note?.origin || !boardId) return [];
    return findFileUsage(wsState.currentId, boards.boards, note.origin, {
      boardId,
      nodes: state.nodes,
    });
  }, [note?.origin, boardId, wsState.currentId, boards.boards, state.nodes]);

  const { view, tool, nodes, selected, selectedEdge, editing } = state;

  /**
   * Момент, когда подсказка про долгое нажатие уместна: блок выбран пальцем,
   * жест закончился, а дальше ничего не произошло — ни правки, ни панели. Ровно
   * здесь человек и упирается в то, что тап больше ничего не открывает.
   *
   * Условие про `drag` обязательно: тап заводит перенос ещё до того, как палец
   * оторвётся, и без него подсказка всплывала бы прямо под движущимся блоком.
   */
  useEffect(() => {
    if (!touchUi || editing || toolsFor) return;
    if (selected.length !== 1 || state.drag.type !== 'none') return;
    showHint();
  }, [touchUi, editing, toolsFor, selected, state.drag.type, showHint]);

  // Frames are containers, so they paint behind everything else. A stable partition (rather than a
  // sort) keeps each node's relative order — and thus its React key position — untouched.
  const renderNodes = useMemo(() => {
    if (!nodes.some((n) => n.kind === 'frame')) return nodes;
    return [...nodes.filter((n) => n.kind === 'frame'), ...nodes.filter((n) => n.kind !== 'frame')];
  }, [nodes]);

  /** Блоки, едущие за указателем прямо сейчас: на пальце они рисуются приподнятыми. */
  const draggingIds = useMemo(
    () => new Set(state.drag.type === 'nodes' ? state.drag.ids : []),
    [state.drag],
  );

  // Frames listed for the jump rail, ordered the way they read on the canvas: top-to-bottom.
  const frames = useMemo(
    () => nodes.filter((n) => n.kind === 'frame').sort((a, b) => a.y - b.y || a.x - b.x),
    [nodes],
  );
  const activeFrameId =
    selected.length === 1 && frames.some((f) => f.id === selected[0]) ? selected[0] : null;

  const focusFrame = (id: string) => {
    const vp = vpRef.current;
    if (!vp) return;
    dispatch({ type: 'EDIT', id: null });
    dispatch({ type: 'SELECT', ids: [id] });
    dispatch({ type: 'FOCUS_NODE', id, width: vp.offsetWidth, height: vp.offsetHeight });
  };

  /* ── Viewport ─────────────────────────────────────────────────────── */

  /** Время и место предыдущего касания холста — по ним распознаётся двойной тап. */
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  /**
   * Зажатый пустой холст переходит из переноса доски в рамку выделения.
   *
   * Одним пальцем доску листают постоянно, поэтому обычное движение осталось
   * переносом; рамка — тот же жест, что и захват блока, только на пустом месте.
   * Отмена начатого переноса обязательна: доска уже поехала за пальцем, и без
   * неё рамка тянулась бы по едущему холсту.
   */
  const viewportPress = useLongPress(
    useCallback(
      (at: PressPoint) => {
        dispatch({ type: 'DRAG_CANCEL' });
        const { x, y } = viewportPoint(at, vpRef.current);
        dispatch({ type: 'DRAG_START', drag: { type: 'select', sx: x, sy: y, ex: x, ey: y } });
      },
      [dispatch],
    ),
  );

  // Only fires for presses that reach the viewport itself — nodes and panels stop propagation.
  const onViewportDown = (e: React.PointerEvent) => {
    if (e.target !== vpRef.current) return;
    const { editing, tool, view } = stateRef.current;
    const touch = e.pointerType !== 'mouse';

    if (editing) dispatch({ type: 'EDIT', id: null });
    dispatch({ type: 'SELECT_EDGE', id: null });
    setToolsFor(null);

    // Middle button, Space+LMB, or the hand tool all mean "pan".
    // Пальцем по пустому холсту — тоже перенос: рамка выделения там ничего не
    // даёт (тапом по узлу выделять удобнее), а двигать доску нужно постоянно, и
    // это единственный жест одним пальцем.
    const touchPan = touch && tool === 'cursor';
    if (e.button === 1 || (e.button === 0 && (spacePan || tool === 'hand' || touchPan))) {
      e.preventDefault();
      dispatch({
        type: 'DRAG_START',
        drag: { type: 'pan', startX: e.clientX, startY: e.clientY, ox: view.x, oy: view.y },
      });
      if (touchPan) {
        // Пустое место — это «ничего не выбрано»: тап по нему снимает выделение,
        // даже если следом окажется переносом доски.
        dispatch({ type: 'SELECT', ids: [] });
        viewportPress.start(e);
        handleTap(e);
      }
      return;
    }
    if (e.button !== 0) return;

    const { x: sx, y: sy } = viewportPoint(e, vpRef.current);
    dispatch({ type: 'SELECT', ids: [] });

    if (tool === 'cursor') {
      dispatch({ type: 'DRAG_START', drag: { type: 'select', sx, sy, ex: sx, ey: sy } });
    } else if (tool === 'pencil') {
      dispatch({ type: 'DRAG_START', drag: { type: 'pencil', points: [toC(sx, sy, view)] } });
    } else {
      dispatch({ type: 'DRAG_START', drag: { type: 'draw', sx, sy, ex: sx, ey: sy } });
    }
  };

  const addNodeAt = (e: { clientX: number; clientY: number }) => {
    const { x, y } = viewportPoint(e, vpRef.current);
    dispatch({ type: 'ADD_NODE', pos: toC(x, y, stateRef.current.view) });
  };

  /**
   * Двойной тап по холсту — то же, что двойной клик: новый блок на этом месте.
   *
   * Событие `dblclick` по касанию браузер не шлёт, поэтому пара засекается
   * вручную. Порог по расстоянию обязателен: без него два быстрых переноса
   * холста в разных его углах читались бы как двойной тап.
   */
  const handleTap = (e: React.PointerEvent) => {
    const now = performance.now();
    const prev = lastTap.current;
    lastTap.current = { t: now, x: e.clientX, y: e.clientY };

    if (!prev || now - prev.t > 300) return;
    if (Math.hypot(e.clientX - prev.x, e.clientY - prev.y) > 24) return;

    lastTap.current = null;
    viewportPress.cancel();
    dispatch({ type: 'DRAG_CANCEL' });
    addNodeAt(e);
  };

  const onViewportDblClick = (e: React.MouseEvent) => {
    if (e.target !== vpRef.current || stateRef.current.tool !== 'cursor') return;
    addNodeAt(e);
  };

  const onZoom = (factor: number) => {
    const vp = vpRef.current;
    if (!vp) return;
    dispatch({ type: 'ZOOM_AT', factor, mx: vp.offsetWidth / 2, my: vp.offsetHeight / 2 });
  };

  /* ── Nodes ────────────────────────────────────────────────────────── */

  /**
   * Заводит перенос блоков. Отдельно от обработчика нажатия, потому что источников
   * два: мышь начинает перенос сразу, а палец — только после долгого нажатия.
   *
   * `ids` приходит снаружи, а не читается из состояния: выделение могло быть
   * отправлено секунду назад тем же обработчиком, а `stateRef` обновляется
   * эффектом — то есть уже после того, как обработчик закончится.
   */
  const beginNodeDrag = useCallback(
    (ids: string[], at: { clientX: number; clientY: number }) => {
      const { nodes } = stateRef.current;

      // Dragging a frame carries its contents: fold every node currently inside a selected frame
      // into the move set, so the frame behaves as one logical unit. Membership is purely spatial,
      // so a block simply dropped inside a frame is picked up next time the frame moves.
      const moving = new Set(ids);
      for (const n of nodes) {
        if (n.kind === 'frame' && ids.includes(n.id)) {
          for (const m of nodesInFrame(nodes, n)) moving.add(m.id);
        }
      }

      const origins: Record<string, XY> = {};
      for (const n of nodes) {
        if (moving.has(n.id)) origins[n.id] = { x: n.x, y: n.y };
      }
      dispatch({
        type: 'DRAG_START',
        drag: {
          type: 'nodes',
          ids: [...moving],
          startX: at.clientX,
          startY: at.clientY,
          origins,
        },
      });
    },
    [dispatch, stateRef],
  );

  // Stable for the component's lifetime — see NodeHandlers on why that matters.
  const nodeHandlers = useMemo<NodeHandlers>(
    () => ({
      onDown: (e, node) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        const { editing, selected } = stateRef.current;

        // Keep the contentEditable focused while dragging the node it belongs to.
        if (editing === node.id) e.preventDefault();
        dispatch({ type: 'SELECT_EDGE', id: null });
        // Панель принадлежит одному блоку: касание любого другого её закрывает.
        setToolsFor((cur) => (cur === node.id ? cur : null));

        let ids: string[];
        if (e.ctrlKey || e.metaKey) {
          ids = selected.includes(node.id)
            ? selected.filter((id) => id !== node.id)
            : [...selected, node.id];
          dispatch({ type: 'SELECT', ids });
        } else if (selected.includes(node.id)) {
          // Dragging one node of an existing multi-selection moves the whole group.
          ids = selected;
        } else {
          ids = [node.id];
          dispatch({ type: 'SELECT', ids });
        }

        // Мышью нажатие и есть начало переноса. Пальцем — только выделение: перенос
        // ждёт долгого нажатия, иначе доску не пролистать, не сдвинув то, за что взялся.
        if (e.pointerType === 'mouse') beginNodeDrag(ids, e);
      },

      onLongPress: (id, at) => {
        const { nodes, selected } = stateRef.current;
        if (!nodes.some((n) => n.id === id)) return;

        markGestureLearned();
        // Выделение уже случилось на касании — группу, если блок в ней, несём целиком.
        beginNodeDrag(selected.includes(id) ? selected : [id], at);
      },

      onEdit: (id) => {
        // Связанная копия показывает чужой текст: править его здесь нельзя, править надо там,
        // где лежит оригинал. Двойной клик по такой ноде просто ничего не делает.
        const node = stateRef.current.nodes.find((n) => n.id === id);
        if (node?.link) return;
        dispatch({ type: 'EDIT', id });
      },

      onTouchOpen: (id) => {
        const node = stateRef.current.nodes.find((n) => n.id === id);
        if (!node) return;

        // Нажатие уже завело перенос блока: без отмены палец, оставшийся на
        // экране, таскал бы открытый на правку блок за собой.
        dispatch({ type: 'DRAG_CANCEL' });
        setToolsFor(id);
        markGestureLearned();

        // Рисунку править нечего, связанной копии — негде (текст ведёт оригинал);
        // панель со свойствами им всё равно полагается.
        if (node.kind !== 'draw' && !node.link) dispatch({ type: 'EDIT', id });
      },

      onConnectorDown: (e, node, side) => {
        dispatch({ type: 'SELECT_EDGE', id: null });
        const { x, y } = viewportPoint(e, vpRef.current);
        dispatch({
          type: 'DRAG_START',
          drag: { type: 'edge', fromId: node.id, fromSide: side, toSX: x, toSY: y },
        });
      },

      onResizeDown: (e, node, edge) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        dispatch({
          type: 'DRAG_START',
          drag: {
            type: 'resize',
            id: node.id,
            edge,
            startX: e.clientX,
            startY: e.clientY,
            origin: { x: node.x, y: node.y, w: node.w, h: node.h },
          },
        });
      },

      onTextInput: (id, text) => dispatch({ type: 'SET_TEXT', id, text }),
      onBlur: () => dispatch({ type: 'EDIT', id: null }),
      onOpenNote: setNote,
    }),
    [dispatch, stateRef, beginNodeDrag, markGestureLearned],
  );

  /* ── Edges ────────────────────────────────────────────────────────── */

  const onEdgeDown = (e: React.PointerEvent, edge: BEdge, verts: XY[]) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dispatch({ type: 'SELECT', ids: [] });

    if (stateRef.current.selectedEdge !== edge.id) {
      dispatch({ type: 'SELECT_EDGE', id: edge.id });
      return;
    }

    // Clicking an already-selected arrow drops a bend point on the segment nearest the cursor.
    const { x, y } = viewportPoint(e, vpRef.current);
    const pt = toC(x, y, stateRef.current.view);

    let bestIdx = 0,
      bestDist = Infinity;
    for (let i = 0; i < verts.length - 1; i++) {
      const d = distToSegment(pt, verts[i], verts[i + 1]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    dispatch({ type: 'ADD_EDGE_BEND', edgeId: edge.id, index: bestIdx, pt });
  };

  const onBendDown = (e: React.PointerEvent, edgeId: string, index: number, origin: XY) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    dispatch({
      type: 'DRAG_START',
      drag: { type: 'edgePoint', edgeId, index, startX: e.clientX, startY: e.clientY, origin },
    });
  };

  const onBendDelete = (
    e: React.MouseEvent | React.PointerEvent,
    edgeId: string,
    index: number,
  ) => {
    e.stopPropagation();
    dispatch({ type: 'DELETE_EDGE_POINT', edgeId, index });
  };

  const deleteSelection = () => {
    setToolsFor(null);
    dispatch({ type: 'DELETE_SELECTION' });
  };

  const closeTools = () => {
    setToolsFor(null);
    dispatch({ type: 'EDIT', id: null });
  };

  /**
   * Кому показывать панель свойств: пальцу — тому блоку, который открыли жестом,
   * мыши — просто выделенному. Пальцем панель держится и во время правки, ради
   * неё жест и делался; на мыши она в правку не лезет, там хватает выделения.
   */
  const propsNode = touchUi
    ? (nodes.find((n) => n.id === toolsFor) ?? null)
    : geom.propsAnchor && geom.selectedNode;

  /**
   * Разрывает связь: нода становится самостоятельной копией со своим файлом.
   *
   * Подпись передаётся вместе с id — у связанной ноды она берётся из имени файла оригинала,
   * а после отвязки её ведёт собственный `text`, и без переноса нода вернулась бы к снимку,
   * сделанному при вставке.
   */
  const unlink = (targets: BNode[]) => {
    const items = targets
      .filter((n) => n.link)
      .map((n) => ({
        id: n.id,
        text: mirrorNodeFor(mirrorIndex, boardId, n)?.name.replace(/\.md$/, '') ?? n.text,
      }));
    if (items.length) dispatch({ type: 'UNLINK', items });
  };

  /* ── Render ───────────────────────────────────────────────────────── */

  return (
    <div className={styles['board-wrap']}>
      <div
        ref={vpRef}
        // Точка входа для e2e. Имена классов хеширует CSS Modules, поэтому цепляться
        // тестам не за что — атрибут переживает любое переименование стилей.
        data-testid="board-viewport"
        className={styles['board-vp']}
        style={{ cursor: viewportCursor(state, spacePan) }}
        onPointerDown={onViewportDown}
        onDoubleClick={onViewportDblClick}
        {...tracker.viewportProps}
      >
        <BoardEdges
          arrows={geom.arrows}
          selectedEdge={selectedEdge}
          previewPath={geom.previewPath}
          pencilPath={geom.pencilPath}
          penColor={state.penColor}
          penWidth={state.penWidth}
          scale={view.scale}
          onEdgeDown={onEdgeDown}
          onBendDown={onBendDown}
          onBendDelete={onBendDelete}
        />

        <div
          className={styles['board-canvas']}
          style={{
            transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})`,
            transformOrigin: '0 0',
          }}
        >
          {renderNodes.map((node) => {
            const mirror = mirrorNodeFor(mirrorIndex, boardId, node);
            return (
              <BoardNode
                key={node.id}
                node={node}
                selected={selected.includes(node.id)}
                soloSelected={selected.length === 1 && selected[0] === node.id}
                editing={editing === node.id}
                dragging={draggingIds.has(node.id)}
                dropSide={geom.dropTargetId === node.id ? geom.dropTargetSide : null}
                fileId={mirror?.id}
                fileName={mirror?.name}
                fileOrigin={node.link ?? (boardId ? { boardId, nodeId: node.id } : undefined)}
                handlers={nodeHandlers}
              />
            );
          })}
        </div>

        {geom.edgeActionAnchor && (
          <EdgeActionBar at={geom.edgeActionAnchor} onDelete={deleteSelection} />
        )}

        {geom.drawPreview && (
          <div
            className={styles['board-draw-preview']}
            style={{
              left: geom.drawPreview.left,
              top: geom.drawPreview.top,
              width: geom.drawPreview.w,
              height: geom.drawPreview.h,
            }}
          />
        )}

        {geom.selectRect && (
          <div
            className={styles['board-select-rect']}
            style={{
              left: geom.selectRect.left,
              top: geom.selectRect.top,
              width: geom.selectRect.w,
              height: geom.selectRect.h,
            }}
          />
        )}

        {geom.guides.map((g, i) => (
          <div
            key={i}
            className={cx(styles['board-guide'], styles[`board-guide-${g.axis}`])}
            style={
              g.axis === 'x'
                ? { left: g.x, top: g.y, height: g.length }
                : { left: g.x, top: g.y, width: g.length }
            }
          />
        ))}

        {propsNode && (
          <NodePropertyBar
            at={touchUi ? null : geom.propsAnchor}
            node={propsNode}
            onFontSize={(delta) => dispatch({ type: 'FONT_SIZE', id: propsNode.id, delta })}
            onShape={(shape) => dispatch({ type: 'SET_SHAPE', id: propsNode.id, shape })}
            onAlign={(align) => dispatch({ type: 'SET_ALIGN', id: propsNode.id, align })}
            onStrokeColor={(color) => dispatch({ type: 'STROKE_COLOR', id: propsNode.id, color })}
            onStrokeWidth={(delta) => dispatch({ type: 'STROKE_WIDTH', id: propsNode.id, delta })}
            onDelete={deleteSelection}
            onUnlink={propsNode.link ? () => unlink([propsNode]) : undefined}
            onClose={touchUi ? closeTools : undefined}
          />
        )}

        {geom.multiAnchor && (
          <MultiSelectBar
            at={geom.multiAnchor}
            count={selected.length}
            onDelete={deleteSelection}
          />
        )}

        <BoardSwitcher boards={boardsWithMirror} uiProps={tracker.uiProps} />

        <BoardToolbar
          tool={tool}
          onSelect={(t) => dispatch({ type: 'SET_TOOL', tool: t })}
          uiProps={tracker.uiProps}
        />

        <FrameWheel
          frames={frames}
          activeId={activeFrameId}
          onFocus={focusFrame}
          uiProps={tracker.uiProps}
        />

        {tool === 'pencil' && (
          <PenPanel
            color={state.penColor}
            width={state.penWidth}
            onColor={(color) => dispatch({ type: 'SET_PEN_COLOR', color })}
            onWidth={(delta) => dispatch({ type: 'PEN_WIDTH', delta })}
            uiProps={tracker.uiProps}
          />
        )}

        <BoardBottomBar
          scale={view.scale}
          onZoom={onZoom}
          onOpenSettings={() => setSettingsOpen(true)}
          uiProps={tracker.uiProps}
        />

        {pastePrompt && (
          <PasteModePopup
            x={pastePrompt.x}
            y={pastePrompt.y}
            count={state.clipboard?.nodes.length ?? 0}
            onPick={(mode) => {
              dispatch({ type: 'PASTE', at: pastePrompt.at, mode });
              setPastePrompt(null);
            }}
            onClose={() => setPastePrompt(null)}
            uiProps={tracker.uiProps}
          />
        )}

        <BoardHint tool={tool} />
        <GestureHint visible={hintVisible} />

        {settingsOpen && (
          <BoardSettingsModal
            settings={state.settings}
            onChange={(patch) => dispatch({ type: 'UPDATE_SETTINGS', patch })}
            onClose={() => setSettingsOpen(false)}
            uiProps={tracker.uiProps}
          />
        )}
      </div>

      <NoteAside
        note={note}
        onClose={() => setNote(null)}
        usage={noteUsage}
        currentBoardId={boardId}
        onGoToBoard={(id) => {
          boards.select(id);
          setNote(null);
        }}
        onUnlink={noteNode?.link ? () => unlink([noteNode]) : undefined}
      />
    </div>
  );
}
