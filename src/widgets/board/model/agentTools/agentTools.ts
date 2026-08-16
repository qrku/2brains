/**
 * MCP-инструменты для правки Доски.
 *
 * Фабрика чистая: React-хуки внутри не вызываются, доступ к стору доски (dispatch + stateRef)
 * приходит аргументом снаружи — компонент, который держит `useBoardStore()`, вызывает
 * `createBoardTools(store)` и регистрирует результат в реестре MCP.
 *
 * Ключевая сложность: `boardReducer` не даёт прямых экшенов ни для перемещения/ресайза ноды, ни
 * для создания связи — и то и другое исключительно побочный эффект drag-машины
 * (DRAG_START → DRAG_MOVE → DRAG_END), рассчитанной на живые события мыши в экранных координатах.
 * Инструменты ниже подделывают ровно одну "виртуальную мышь": считают экранную точку для нужной
 * канвас-точки через `toS` (используя текущий `view` из stateRef) и прогоняют её через ту же самую
 * машину состояний, что и реальный указатель, — так поведение (включая smart-snapping) не
 * приходится переизобретать, а гарантированно совпадает с ручным управлением.
 *
 * Стор читается только через `stateRef.current` (см. комментарий над ним в useBoardStore.ts) —
 * пропсы рендера, замкнутые в фабрике на момент её вызова, устаревают уже между двумя
 * последовательными вызовами модели.
 */

import type { BNode, NodeKind, NodeShape, Side, XY } from '@/entities/board';
import {
  CONNECTOR_STANDOFF,
  DEF_FRAME_H,
  DEF_FRAME_W,
  DEF_H,
  DEF_W,
  sidePoint,
  toS,
} from '@/entities/board';
import { fail, ok, type McpTool, type McpToolResult } from '@/shared/lib/mcp/types';
import type { BoardStore } from '../useBoardStore';

const LIST_LIMIT = 150;
const TEXT_PREVIEW_MAX = 80;
const WAIT_TRIES = 100;
const WAIT_DELAY_MS = 10;

const KINDS = ['box', 'text', 'frame'] as const;
const SHAPES = ['rect', 'diamond', 'circle'] as const;
const SIDES = ['n', 's', 'e', 'w'] as const;

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Ждёт, пока `stateRef` отразит уже отправленные диспатчи: React-рендер и синхронизирующий
 * useEffect (см. useBoardStore.ts) происходят не мгновенно после dispatch. Опрашиваем с небольшой
 * паузой вместо того, чтобы читать стор сразу же и рисковать увидеть старое значение.
 */
async function waitFor<T>(check: () => T | undefined): Promise<T | undefined> {
  for (let i = 0; i < WAIT_TRIES; i++) {
    const v = check();
    if (v !== undefined) return v;
    await new Promise((resolve) => setTimeout(resolve, WAIT_DELAY_MS));
  }
  return undefined;
}

/** То же самое ожидание, когда результат не «появление новой сущности», а просто «стор догнал». */
async function flush(ticks = 5): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** Точка коннектора на стороне ноды — с тем же отступом CONNECTOR_STANDOFF, что рисует сама Доска. */
function postPoint(n: BNode, side: Side): XY {
  const p = sidePoint(n, side);
  switch (side) {
    case 'n':
      return { x: p.x, y: p.y - CONNECTOR_STANDOFF };
    case 's':
      return { x: p.x, y: p.y + CONNECTOR_STANDOFF };
    case 'e':
      return { x: p.x + CONNECTOR_STANDOFF, y: p.y };
    case 'w':
      return { x: p.x - CONNECTOR_STANDOFF, y: p.y };
  }
}

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function describeNode(n: BNode): string {
  const text = n.text.length > TEXT_PREVIEW_MAX ? `${n.text.slice(0, TEXT_PREVIEW_MAX)}…` : n.text;
  const shape = n.kind === 'box' ? `/${n.shape}` : '';
  return `${n.id} | ${n.kind}${shape} | x:${fmt(n.x)} y:${fmt(n.y)} w:${fmt(n.w)} h:${fmt(n.h)} | "${text.replace(/\n/g, '\\n')}"`;
}

const COORD_HINT =
  'Координаты — в системе координат холста (canvas), а не экрана: текущий масштаб и прокрутка ' +
  'вида роли не играют. Разумные значения — примерно от -3000 до 3000 по каждой оси. Перед тем как ' +
  'добавлять или переносить ноду, сверься с board_list_nodes, чтобы она не легла поверх ' +
  'существующих — обычно достаточно отступа в 30-60 единиц.';

export function createBoardTools(store: BoardStore): McpTool[] {
  const findNode = (id: unknown): BNode | undefined =>
    isStr(id) ? store.stateRef.current.nodes.find((n) => n.id === id) : undefined;

  const listNodes: McpTool = {
    name: 'board_list_nodes',
    description:
      `Список нод на Доске: id, вид, координаты левого верхнего угла, размер и текст. ${COORD_HINT} ` +
      `Вывод компактный — текст каждой ноды обрезан до ${TEXT_PREVIEW_MAX} символов, а число нод в ` +
      'ответе ограничено; если на доске их больше, список будет обрезан и об этом будет сказано явно. ' +
      'id из этого списка нужны всем остальным board_* инструментам.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: `Максимум нод в ответе (по умолчанию и не больше ${LIST_LIMIT} за один вызов).`,
        },
      },
    },
    run(args): McpToolResult {
      const nodes = store.stateRef.current.nodes;
      if (!nodes.length) return ok('На доске пока нет нод.');

      let limit = LIST_LIMIT;
      if (args.limit !== undefined) {
        if (!isNum(args.limit) || args.limit <= 0)
          return fail('limit должен быть положительным числом.');
        limit = Math.min(LIST_LIMIT, Math.floor(args.limit));
      }

      const shown = nodes.slice(0, limit);
      let text = `Нод на доске: ${nodes.length}.\n${shown.map(describeNode).join('\n')}`;
      if (shown.length < nodes.length) {
        text += `\n… показаны первые ${shown.length} из ${nodes.length}, список обрезан — запроси нужные ноды точечнее.`;
      }
      return ok(text);
    },
  };

  const addNode: McpTool = {
    name: 'board_add_node',
    description:
      `Добавляет на Доску новую ноду и возвращает её id. ${COORD_HINT} x,y — координаты ЛЕВОГО ` +
      'ВЕРХНЕГО угла новой ноды (как в выводе board_list_nodes), а не центра. kind задаёт вид: ' +
      '"box" — блок с рамкой (по умолчанию, единственный вид, для которого имеет смысл shape), ' +
      '"text" — текст без рамки, "frame" — большая область-контейнер для группировки других нод ' +
      '(в frame нельзя провести связь board_connect_nodes). text можно оставить пустым и заполнить ' +
      'или поменять позже через board_set_text.',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X левого верхнего угла в координатах холста.' },
        y: { type: 'number', description: 'Y левого верхнего угла в координатах холста.' },
        text: {
          type: 'string',
          description: 'Текст внутри ноды. Можно опустить — по умолчанию пусто.',
        },
        kind: {
          type: 'string',
          enum: [...KINDS],
          description: 'Вид ноды: box (по умолчанию) | text | frame.',
        },
        shape: {
          type: 'string',
          enum: [...SHAPES],
          description: 'Форма рамки для kind="box": rect (по умолчанию) | diamond | circle.',
        },
      },
      required: ['x', 'y'],
    },
    async run(args): Promise<McpToolResult> {
      if (!isNum(args.x) || !isNum(args.y)) return fail('x и y обязательны и должны быть числами.');

      const kindArg = args.kind === undefined ? 'box' : args.kind;
      if (!isStr(kindArg) || !(KINDS as readonly string[]).includes(kindArg)) {
        return fail(`kind должен быть одним из: ${KINDS.join(', ')}.`);
      }
      const shapeArg = args.shape === undefined ? 'rect' : args.shape;
      if (!isStr(shapeArg) || !(SHAPES as readonly string[]).includes(shapeArg)) {
        return fail(`shape должен быть одним из: ${SHAPES.join(', ')}.`);
      }
      if (args.text !== undefined && !isStr(args.text)) return fail('text должен быть строкой.');

      const kind = kindArg as NodeKind;
      const shape = shapeArg as NodeShape;
      const text = isStr(args.text) ? args.text : '';
      const w = kind === 'frame' ? DEF_FRAME_W : DEF_W;
      const h = kind === 'frame' ? DEF_FRAME_H : DEF_H;
      const cx = args.x + w / 2,
        cy = args.y + h / 2;

      const before = new Set(store.stateRef.current.nodes.map((n) => n.id));

      if (kind === 'box') {
        // ADD_NODE — единственный экшен, который создаёт ноду напрямую в канвас-координатах, без
        // обращения к drag-машине и текущему view. Поэтому это безопасный путь по умолчанию: он не
        // может столкнуться с параллельным перетаскиванием мышью, потому что ничего в drag-состоянии
        // не трогает.
        store.dispatch({ type: 'ADD_NODE', pos: { x: cx, y: cy } });
      } else {
        // 'text' и 'frame' реализованы в редьюсере только как результат "клика" с выбранным
        // инструментом (DRAG_END на почти нулевом перемещении). Симулируем этот путь: временно
        // выставляем инструмент, коротко открываем и тут же закрываем drag — редьюсер сам вернёт
        // tool в 'cursor' по завершении. Если сейчас пользователь и так что-то тащит, drag-состояние
        // трогать не даём, чтобы не оборвать его собственное перетаскивание.
        if (store.stateRef.current.drag.type !== 'none') {
          return fail(
            'Сейчас на доске активен захват мышью (пользователь что-то тащит) — повтори попытку через момент.',
          );
        }
        const s = toS(cx, cy, store.stateRef.current.view);
        store.dispatch({ type: 'SET_TOOL', tool: kind === 'text' ? 'text' : 'frame' });
        store.dispatch({
          type: 'DRAG_START',
          drag: { type: 'draw', sx: s.x, sy: s.y, ex: s.x, ey: s.y },
        });
        store.dispatch({ type: 'DRAG_END', pos: { sx: s.x, sy: s.y, clientX: s.x, clientY: s.y } });
      }

      // ADD_NODE (и DRAG_END-эквивалент) генерируют id внутри `uid()` и никак не возвращают его
      // наружу. Единственный надёжный способ узнать id новой ноды — сравнить множество id "до" и
      // "после" диспатча. Это устойчиво к параллельным действиям пользователя мышью: перемещение,
      // выбор или ресайз существующих нод не меняют набор id вообще. Если пользователь тоже успел
      // создать свою ноду прямо в этот момент, берём последнюю добавленную — наша всегда дописывается
      // в конец массива `nodes`, так что при дописывании после чужой мы попадём точно в неё.
      const id = await waitFor(() => {
        const added = store.stateRef.current.nodes.filter((n) => !before.has(n.id));
        return added.length ? added[added.length - 1].id : undefined;
      });
      if (!id)
        return fail(
          'Не удалось создать ноду: Доска не подтвердила изменение вовремя, попробуй ещё раз.',
        );

      if (kind === 'box' && shape !== 'rect') store.dispatch({ type: 'SET_SHAPE', id, shape });
      if (text) store.dispatch({ type: 'SET_TEXT', id, text });

      return ok(
        `Нода создана: id ${id}, kind ${kind}${kind === 'box' ? `/${shape}` : ''}, x:${fmt(args.x)} y:${fmt(args.y)} w:${w} h:${h}.`,
      );
    },
  };

  const setText: McpTool = {
    name: 'board_set_text',
    description:
      'Заменяет текст ноды целиком (не дописывает, а перезаписывает). Разрушающее действие — старый текст теряется без возможности отмены.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id ноды из board_list_nodes.' },
        text: {
          type: 'string',
          description: 'Новый текст ноды (можно пустую строку, чтобы очистить).',
        },
      },
      required: ['id', 'text'],
    },
    destructive: true,
    run(args): McpToolResult {
      if (!isStr(args.id)) return fail('id обязателен и должен быть строкой.');
      if (!isStr(args.text)) return fail('text обязателен и должен быть строкой.');
      const node = findNode(args.id);
      if (!node) return fail(`Нода с id "${args.id}" не найдена. Проверь board_list_nodes.`);
      store.dispatch({ type: 'SET_TEXT', id: args.id, text: args.text });
      return ok(`Текст ноды ${args.id} обновлён.`);
    },
  };

  const moveNode: McpTool = {
    name: 'board_move_node',
    description:
      `Переносит существующую ноду на новые координаты. ${COORD_HINT} x,y — новый левый верхний угол ` +
      '(как в выводе board_list_nodes). Итоговая позиция может слегка (на несколько единиц) ' +
      'сместиться мягким прилипанием к соседним нодам — так же, как при обычном перетаскивании мышью.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id ноды из board_list_nodes.' },
        x: { type: 'number', description: 'Новый X левого верхнего угла.' },
        y: { type: 'number', description: 'Новый Y левого верхнего угла.' },
      },
      required: ['id', 'x', 'y'],
    },
    async run(args): Promise<McpToolResult> {
      if (!isStr(args.id)) return fail('id обязателен и должен быть строкой.');
      if (!isNum(args.x) || !isNum(args.y)) return fail('x и y обязательны и должны быть числами.');
      const node = findNode(args.id);
      if (!node) return fail(`Нода с id "${args.id}" не найдена. Проверь board_list_nodes.`);
      // Перемещение возможно только через drag-машину (нет прямого SET_POSITION), а она общая с
      // указателем пользователя — не встреваем, если сейчас идёт живое перетаскивание.
      if (store.stateRef.current.drag.type !== 'none') {
        return fail('Сейчас на доске активен захват мышью — повтори попытку через момент.');
      }

      const scale = store.stateRef.current.view.scale;
      const dx = args.x - node.x,
        dy = args.y - node.y;
      // DRAG_MOVE считает дельту как (clientX - startX) / scale, поэтому чтобы получить ровно
      // нужную канвас-дельту, экранную дельту берём уже умноженной на текущий scale. sx/sy для
      // ветки 'nodes' не используются вовсе — там значимы только clientX/clientY.
      const clientX = dx * scale,
        clientY = dy * scale;

      store.dispatch({
        type: 'DRAG_START',
        drag: {
          type: 'nodes',
          ids: [args.id],
          startX: 0,
          startY: 0,
          origins: { [args.id]: { x: node.x, y: node.y } },
        },
      });
      store.dispatch({ type: 'DRAG_MOVE', pos: { sx: 0, sy: 0, clientX, clientY } });
      store.dispatch({ type: 'DRAG_END', pos: { sx: 0, sy: 0, clientX, clientY } });

      await flush();
      const moved = store.stateRef.current.nodes.find((n) => n.id === args.id);
      if (!moved)
        return fail(
          'Нода исчезла во время перемещения (возможно, её удалили) — проверь board_list_nodes.',
        );
      return ok(`Нода ${args.id} перемещена на x:${fmt(moved.x)} y:${fmt(moved.y)}.`);
    },
  };

  const resizeNode: McpTool = {
    name: 'board_resize_node',
    description:
      'Меняет ширину/высоту существующей ноды, не трогая положение левого верхнего угла (нода растёт ' +
      'вправо-вниз). Для формы circle ширина и высота всегда равны — итоговый размер круга берётся ' +
      'как среднее между желаемыми width и height. Итоговый размер может слегка скорректироваться ' +
      'мягким прилипанием к соседним нодам, как при ручном ресайзе, и не может быть меньше ~40×24 ' +
      'единиц — слишком маленькое значение будет автоматически увеличено.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id ноды из board_list_nodes.' },
        width: { type: 'number', description: 'Новая ширина в единицах холста, больше 0.' },
        height: { type: 'number', description: 'Новая высота в единицах холста, больше 0.' },
      },
      required: ['id', 'width', 'height'],
    },
    async run(args): Promise<McpToolResult> {
      if (!isStr(args.id)) return fail('id обязателен и должен быть строкой.');
      if (!isNum(args.width) || !isNum(args.height))
        return fail('width и height обязательны и должны быть числами.');
      if (args.width <= 0 || args.height <= 0)
        return fail('width и height должны быть положительными числами.');
      const node = findNode(args.id);
      if (!node) return fail(`Нода с id "${args.id}" не найдена. Проверь board_list_nodes.`);
      if (store.stateRef.current.drag.type !== 'none') {
        return fail('Сейчас на доске активен захват мышью — повтори попытку через момент.');
      }

      const scale = store.stateRef.current.view.scale;
      const dx = args.width - node.w,
        dy = args.height - node.h;
      const clientX = dx * scale,
        clientY = dy * scale;
      const origin = { x: node.x, y: node.y, w: node.w, h: node.h };

      // Всегда тянем угол 'se' (юго-восток): растим ноду вправо-вниз, левый верхний угол не
      // сдвигается — предсказуемое поведение для программного вызова.
      store.dispatch({
        type: 'DRAG_START',
        drag: { type: 'resize', id: args.id, edge: 'se', startX: 0, startY: 0, origin },
      });
      store.dispatch({ type: 'DRAG_MOVE', pos: { sx: 0, sy: 0, clientX, clientY } });
      store.dispatch({ type: 'DRAG_END', pos: { sx: 0, sy: 0, clientX, clientY } });

      await flush();
      const resized = store.stateRef.current.nodes.find((n) => n.id === args.id);
      if (!resized)
        return fail(
          'Нода исчезла во время изменения размера (возможно, её удалили) — проверь board_list_nodes.',
        );
      return ok(`Нода ${args.id} теперь w:${fmt(resized.w)} h:${fmt(resized.h)}.`);
    },
  };

  const connectNodes: McpTool = {
    name: 'board_connect_nodes',
    description:
      'Создаёт стрелку-связь между двумя нодами. Сторона подключения на каждой из них подбирается ' +
      'автоматически по взаимному расположению нод (можно переопределить fromSide/toSide вручную). ' +
      'В ноду-frame провести связь нельзя — у фреймов нет точек подключения. Повторный вызов для той ' +
      'же пары id и тех же сторон не создаст дубликат — вернётся ошибка о том, что связь уже есть.',
    inputSchema: {
      type: 'object',
      properties: {
        fromId: { type: 'string', description: 'id ноды-источника стрелки.' },
        toId: { type: 'string', description: 'id ноды-получателя стрелки.' },
        fromSide: {
          type: 'string',
          enum: [...SIDES],
          description:
            'Сторона источника (n/s/e/w). Необязательно — по умолчанию подбирается автоматически.',
        },
        toSide: {
          type: 'string',
          enum: [...SIDES],
          description:
            'Сторона получателя (n/s/e/w). Необязательно — по умолчанию подбирается автоматически.',
        },
      },
      required: ['fromId', 'toId'],
    },
    async run(args): Promise<McpToolResult> {
      if (!isStr(args.fromId) || !isStr(args.toId))
        return fail('fromId и toId обязательны и должны быть строками.');
      if (args.fromId === args.toId) return fail('Нельзя соединить ноду саму с собой.');
      const fromNode = findNode(args.fromId);
      const toNode = findNode(args.toId);
      if (!fromNode)
        return fail(`Нода с id "${args.fromId}" не найдена. Проверь board_list_nodes.`);
      if (!toNode) return fail(`Нода с id "${args.toId}" не найдена. Проверь board_list_nodes.`);
      if (toNode.kind === 'frame')
        return fail('Нельзя провести связь в ноду-frame — у фреймов нет точек подключения.');

      let fromSide: Side, toSide: Side;
      if (args.fromSide !== undefined || args.toSide !== undefined) {
        if (!isStr(args.fromSide) || !(SIDES as readonly string[]).includes(args.fromSide)) {
          return fail(`fromSide должен быть одним из: ${SIDES.join(', ')}.`);
        }
        if (!isStr(args.toSide) || !(SIDES as readonly string[]).includes(args.toSide)) {
          return fail(`toSide должен быть одним из: ${SIDES.join(', ')}.`);
        }
        fromSide = args.fromSide as Side;
        toSide = args.toSide as Side;
      } else {
        const fc = { x: fromNode.x + fromNode.w / 2, y: fromNode.y + fromNode.h / 2 };
        const tc = { x: toNode.x + toNode.w / 2, y: toNode.y + toNode.h / 2 };
        const dx = tc.x - fc.x,
          dy = tc.y - fc.y;
        if (Math.abs(dx) >= Math.abs(dy)) {
          fromSide = dx >= 0 ? 'e' : 'w';
          toSide = dx >= 0 ? 'w' : 'e';
        } else {
          fromSide = dy >= 0 ? 's' : 'n';
          toSide = dy >= 0 ? 'n' : 's';
        }
      }

      // Связь тоже создаётся только через drag-машину (тип 'edge'): нет прямого ADD_EDGE.
      if (store.stateRef.current.drag.type !== 'none') {
        return fail('Сейчас на доске активен захват мышью — повтори попытку через момент.');
      }

      // Целимся ровно в коннектор toNode: расстояние до него будет нулевым, так что
      // findConnectorMagnet внутри редьюсера гарантированно подхватит именно его, а не случайный
      // соседний узел.
      const target = postPoint(toNode, toSide);
      const screenPt = toS(target.x, target.y, store.stateRef.current.view);
      const before = new Set(store.stateRef.current.edges.map((e) => e.id));

      store.dispatch({
        type: 'DRAG_START',
        drag: { type: 'edge', fromId: args.fromId, fromSide, toSX: screenPt.x, toSY: screenPt.y },
      });
      store.dispatch({
        type: 'DRAG_END',
        pos: { sx: screenPt.x, sy: screenPt.y, clientX: screenPt.x, clientY: screenPt.y },
      });

      const id = await waitFor(
        () => store.stateRef.current.edges.find((e) => !before.has(e.id))?.id,
      );
      if (!id) {
        return fail(
          `Не удалось создать связь между "${args.fromId}" и "${args.toId}" — либо такая связь уже ` +
            'существует, либо точка подключения не найдена. Проверь board_list_nodes и попробуй другие стороны.',
        );
      }
      return ok(
        `Связь создана: ${args.fromId} (${fromSide}) → ${args.toId} (${toSide}), id связи ${id}.`,
      );
    },
  };

  const deleteNodes: McpTool = {
    name: 'board_delete_nodes',
    description:
      'Удаляет одну или несколько нод по id вместе со связями, которые к ним подходят. Разрушающее действие, отменить нельзя.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Список id нод для удаления (см. board_list_nodes). Минимум один id.',
        },
      },
      required: ['ids'],
    },
    destructive: true,
    async run(args): Promise<McpToolResult> {
      if (!Array.isArray(args.ids) || args.ids.length === 0)
        return fail('ids обязателен и должен быть непустым массивом строк.');
      const rawIds: unknown[] = args.ids;
      if (!rawIds.every(isStr)) return fail('ids должен быть массивом строк.');
      const ids = rawIds as string[];

      const existing = new Set(store.stateRef.current.nodes.map((n) => n.id));
      const missing = ids.filter((id) => !existing.has(id));
      if (missing.length)
        return fail(
          `Ноды с такими id не найдены: ${missing.join(', ')}. Проверь board_list_nodes.`,
        );

      // DELETE_SELECTION удаляет то, что сейчас выбрано в UI, а если выбрана связь — удалит её, а не
      // ноды (неочевидная деталь редьюсера: он отдаёт приоритет selectedEdge). Поэтому сначала явно
      // снимаем выбор связи и выставляем нужный набор нод через SELECT — это простое присваивание
      // состояния, drag-машину не трогает и поэтому безопасно относительно параллельной работы мышью.
      store.dispatch({ type: 'SELECT_EDGE', id: null });
      store.dispatch({ type: 'SELECT', ids });
      store.dispatch({ type: 'DELETE_SELECTION' });

      await flush();
      const stillThere = ids.filter((id) => store.stateRef.current.nodes.some((n) => n.id === id));
      if (stillThere.length)
        return fail(
          `Не удалось удалить ноды: ${stillThere.join(', ')}. Возможно, доска изменилась во время выполнения — проверь board_list_nodes.`,
        );
      return ok(`Удалено нод: ${ids.length} (${ids.join(', ')}).`);
    },
  };

  return [listNodes, addNode, setText, moveNode, resizeNode, connectNodes, deleteNodes];
}
