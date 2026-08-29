/**
 * Серверный прокси к OpenRouter для AI-агента.
 *
 * Ключ OpenRouter не должен попасть в браузер, поэтому клиент шлёт сюда
 * `AgentChatRequest`, а роут добавляет ключ, дергает OpenRouter и стримит
 * ответ обратно как SSE-события `AgentStreamEvent`. Сами инструменты роут
 * не исполняет — он только прокидывает их описания модели и возвращает то,
 * что модель попросила вызвать; вызов инструментов происходит в браузере.
 */

import type {
  AgentContext,
  AgentStreamEvent,
  ChatMessage,
  ToolCall,
  ToolSpec,
} from '@/entities/agent';
import { buildSystemPrompt } from '@/entities/agent';

// Роут стримит ответ по мере поступления — кэшировать его нельзя,
// а на Edge-рантайме нет доступа к части Node API, которые могут понадобиться стриму.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/** Переводит HTTP-статус OpenRouter в понятное пользователю сообщение по-русски. */
function upstreamErrorMessage(status: number): string {
  // `User not found` OpenRouter отдаёт и на provisioning-ключ: такой ключ валиден, но им
  // выпускают другие ключи, а обращаться к моделям нельзя. Подсказываем, иначе поиск причины
  // уходит в проверку биллинга, где всё в порядке.
  if (status === 401) {
    return 'Ключ OpenRouter не подходит для обращения к моделям — проверьте, что это inference-ключ, а не provisioning';
  }
  if (status === 402) return 'На OpenRouter закончились кредиты';
  if (status === 429) return 'OpenRouter: слишком много запросов, подождите и попробуйте снова';
  if (status >= 500) return 'OpenRouter временно недоступен';
  return `OpenRouter вернул ошибку (${status})`;
}

/** Минимум полей ошибки OpenRouter/OpenAI, которые нам нужны из тела ответа. */
interface UpstreamErrorBody {
  error?: { message?: string };
}

async function readUpstreamErrorDetail(response: Response): Promise<string | undefined> {
  try {
    const data = (await response.json()) as UpstreamErrorBody;
    return data?.error?.message;
  } catch {
    return undefined;
  }
}

/* ─── Форма чанков потока OpenRouter (OpenAI-совместимый формат) ──────────── */

interface OpenRouterToolCallDelta {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface OpenRouterStreamChoice {
  delta?: {
    content?: string;
    tool_calls?: OpenRouterToolCallDelta[];
  };
  finish_reason?: string | null;
}

interface OpenRouterStreamChunk {
  choices?: OpenRouterStreamChoice[];
}

/** Накопленный (ещё, возможно, не до конца собранный) вызов инструмента. */
interface ToolCallAccumulator {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/* ─── Валидация тела запроса ───────────────────────────────────────────────
 * Всё, что уходит в апстрим, оплачивается ключом владельца, поэтому тело не
 * прокидывается насквозь: каждое сообщение пересобирается из проверенных полей.
 * Роль `system` от клиента не принимается вообще — системный промпт собирает
 * сервер (см. buildSystemPrompt ниже), иначе поведение агента задаёт клиент. */

const MAX_MESSAGES = 60;
const MAX_TOTAL_CHARS = 200_000;
const MAX_TOOL_CALLS_PER_MESSAGE = 16;
const MAX_TOOLS = 64;
const MAX_TOOL_DESCRIPTION_CHARS = 2000;
/** Потолок на ответ модели: без него один запрос может стоить сколько угодно. */
const MAX_TOKENS = 2048;
const UPSTREAM_TIMEOUT_MS = 60_000;

const ALLOWED_ROLES = new Set<ChatMessage['role']>(['user', 'assistant', 'tool']);
const ALLOWED_PAGES = new Set<AgentContext['page']>(['space', 'board', 'other']);
const TOOL_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;

type ValidBody =
  | { ok: true; messages: ChatMessage[]; tools: ToolSpec[]; context: AgentContext }
  | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateToolCalls(raw: unknown): ToolCall[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_TOOL_CALLS_PER_MESSAGE) return null;
  const calls: ToolCall[] = [];
  for (const c of raw) {
    if (!isRecord(c) || !isRecord(c.function)) return null;
    const { id, function: fn } = c;
    if (typeof id !== 'string' || typeof fn.name !== 'string' || typeof fn.arguments !== 'string')
      return null;
    if (!TOOL_NAME_RE.test(fn.name)) return null;
    calls.push({ id, type: 'function', function: { name: fn.name, arguments: fn.arguments } });
  }
  return calls;
}

function validateContext(raw: unknown): AgentContext {
  const o = isRecord(raw) ? raw : {};
  const page =
    typeof o.page === 'string' && ALLOWED_PAGES.has(o.page as AgentContext['page'])
      ? (o.page as AgentContext['page'])
      : 'other';
  // Значения контекста подставляются в системный промпт, поэтому обрезаются по длине:
  // это не даёт превратить название воркспейса в отдельную инструкцию модели.
  return {
    page,
    workspaceName: typeof o.workspaceName === 'string' ? o.workspaceName.slice(0, 80) : '',
    openFilePath: typeof o.openFilePath === 'string' ? o.openFilePath.slice(0, 300) : undefined,
  };
}

function validateBody(value: unknown): ValidBody {
  if (!isRecord(value)) return { ok: false, error: 'Тело запроса должно быть объектом' };
  if (!Array.isArray(value.messages)) {
    return { ok: false, error: 'Поле messages обязано присутствовать и быть массивом' };
  }
  if (value.messages.length === 0 || value.messages.length > MAX_MESSAGES) {
    return { ok: false, error: `История должна содержать от 1 до ${MAX_MESSAGES} сообщений` };
  }

  const messages: ChatMessage[] = [];
  let totalChars = 0;

  for (const raw of value.messages) {
    if (!isRecord(raw)) return { ok: false, error: 'Каждое сообщение должно быть объектом' };
    const { role, content } = raw;
    if (typeof role !== 'string' || !ALLOWED_ROLES.has(role as ChatMessage['role'])) {
      return { ok: false, error: `Недопустимая роль сообщения: ${String(role)}` };
    }
    if (typeof content !== 'string')
      return { ok: false, error: 'Поле content должно быть строкой' };

    totalChars += content.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return { ok: false, error: `Суммарная длина истории превышает ${MAX_TOTAL_CHARS} символов` };
    }

    const message: ChatMessage = { role: role as ChatMessage['role'], content };

    if (role === 'assistant' && raw.tool_calls !== undefined) {
      const calls = validateToolCalls(raw.tool_calls);
      if (!calls) return { ok: false, error: 'Некорректный tool_calls в сообщении ассистента' };
      if (calls.length > 0) message.tool_calls = calls;
    }
    if (role === 'tool') {
      if (typeof raw.tool_call_id !== 'string') {
        return { ok: false, error: 'Сообщение роли tool обязано содержать tool_call_id' };
      }
      message.tool_call_id = raw.tool_call_id;
    }

    messages.push(message);
  }

  const rawTools = Array.isArray(value.tools) ? value.tools : [];
  if (rawTools.length > MAX_TOOLS) {
    return { ok: false, error: `Инструментов не может быть больше ${MAX_TOOLS}` };
  }

  const tools: ToolSpec[] = [];
  for (const raw of rawTools) {
    if (!isRecord(raw) || !isRecord(raw.function)) {
      return { ok: false, error: 'Некорректное описание инструмента' };
    }
    const fn = raw.function;
    if (typeof fn.name !== 'string' || !TOOL_NAME_RE.test(fn.name)) {
      return { ok: false, error: `Некорректное имя инструмента: ${String(fn.name)}` };
    }
    if (!isRecord(fn.parameters) || fn.parameters.type !== 'object') {
      return { ok: false, error: `У инструмента ${fn.name} некорректный parameters` };
    }
    tools.push({
      type: 'function',
      function: {
        name: fn.name,
        description:
          typeof fn.description === 'string'
            ? fn.description.slice(0, MAX_TOOL_DESCRIPTION_CHARS)
            : '',
        parameters: fn.parameters as unknown as ToolSpec['function']['parameters'],
      },
    });
  }

  return { ok: true, messages, tools, context: validateContext(value.context) };
}

/* ─── Защита роута ─────────────────────────────────────────────────────────
 * Роут тратит деньги с ключа владельца и авторизации в приложении пока нет, так что
 * ограничиваем его тем, ради чего он существует: запросами с собственных страниц.
 * Это не замена настоящей аутентификации — её нужно добавить, когда приложение
 * начнёт обслуживать больше одного человека. */

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

// Счётчик на globalThis: Next в dev пересоздаёт модуль при hot-reload вместе с состоянием.
// Для одного инстанса этого достаточно; за несколькими это должен быть общий стор.
const g = globalThis as typeof globalThis & { __agentRate?: Map<string, number[]> };
const hits = (g.__agentRate ??= new Map<string, number[]>());

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > RATE_MAX;
}

/** Запрос со страницы приложения, а не со стороннего сайта или curl'ом. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  // Same-origin fetch из браузера Origin не всегда шлёт; тогда полагаемся на Referer.
  if (!origin) {
    const referer = request.headers.get('referer');
    if (!referer) return false;
    try {
      return new URL(referer).host === new URL(request.url).host;
    } catch {
      return false;
    }
  }
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) {
    return jsonError('Запрос отклонён: разрешены только обращения со страниц приложения', 403);
  }

  const client = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
  if (rateLimited(client)) {
    return jsonError(`Слишком много запросов — не больше ${RATE_MAX} в минуту`, 429);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError('Тело запроса должно быть валидным JSON', 400);
  }

  const parsed = validateBody(rawBody);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const { tools, context } = parsed;
  // Системный промпт собирается здесь, а не в браузере: иначе роль и правила агента
  // задаёт клиент, а платит за это ключ владельца.
  const system: ChatMessage = { role: 'system', content: buildSystemPrompt(context, tools.length) };
  const messages: ChatMessage[] = [system, ...parsed.messages];

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;

  if (!apiKey) {
    // Ключ никогда не логируем и не отдаём клиенту — только факт его отсутствия.
    console.error('[api/agent/chat] OPENROUTER_API_KEY не задан в окружении сервера');
    return jsonError('Сервер не настроен: отсутствует ключ OpenRouter', 500);
  }
  if (!model) {
    console.error('[api/agent/chat] OPENROUTER_MODEL не задан в окружении сервера');
    return jsonError('Сервер не настроен: не указана модель OpenRouter', 500);
  }

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter использует эти два заголовка для атрибуции приложения.
        'HTTP-Referer': request.headers.get('origin') ?? 'https://2brains.local',
        'X-Title': '2brains',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: MAX_TOKENS,
        // Пустой tools + tool_choice часть OpenAI-совместимых эндпоинтов отвергает 400-й,
        // а на страницах без инструментов набор как раз пустой.
        ...(tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
      }),
      // Отмена на клиенте и таймаут обрывают и генерацию в апстриме — иначе она
      // продолжает считаться (и стоить) после того, как ответ уже никому не нужен.
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]),
    });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    console.error('[api/agent/chat] Не удалось выполнить запрос к OpenRouter', error);
    return jsonError('Не удалось связаться с OpenRouter', 502);
  }

  // Ошибка ДО начала стрима — обычный JSON с корректным HTTP-статусом.
  if (!upstream.ok || !upstream.body) {
    // Детали апстрима пишем в лог сервера, но не пересылаем клиенту дословно:
    // там встречаются идентификаторы аккаунта и внутренние сообщения провайдера.
    const detail = await readUpstreamErrorDetail(upstream);
    console.error('[api/agent/chat] OpenRouter ответил ошибкой', upstream.status, detail);
    return jsonError(upstreamErrorMessage(upstream.status), upstream.status || 502);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const send = (event: AgentStreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Объявлен до finish(), определён ниже: finish() дозаливает накопленные вызовы,
      // чтобы обрыв стрима без [DONE] их не терял.
      let flushToolCalls: () => void;

      const finish = () => {
        if (closed) return;
        // `done` отправляется ДО установки closed — иначе send() отсекает его сам,
        // и клиент не может отличить штатное завершение от обрыва соединения.
        flushToolCalls();
        send({ type: 'done' });
        closed = true;
        controller.close();
      };

      // Фрагменты tool_calls копятся по index и собираются в единый вызов,
      // когда стрим сигналит finish_reason или [DONE] — наружу уходит только
      // полностью собранный JSON в arguments, никогда обрывок.
      const toolCallsAcc = new Map<number, ToolCallAccumulator>();

      flushToolCalls = () => {
        if (toolCallsAcc.size === 0) return;
        const calls: ToolCall[] = Array.from(toolCallsAcc.entries())
          .sort(([indexA], [indexB]) => indexA - indexB)
          .map(([, call]) => call);
        toolCallsAcc.clear();
        send({ type: 'tool_calls', calls });
      };

      const processChunk = (payload: string) => {
        let chunk: OpenRouterStreamChunk;
        try {
          chunk = JSON.parse(payload) as OpenRouterStreamChunk;
        } catch {
          // Неполный/битый JSON — такое не должно случаться при построчной
          // резке по буферу, но на всякий случай просто пропускаем чанк.
          return;
        }

        const choice = chunk.choices?.[0];
        if (!choice) return;

        const delta = choice.delta ?? {};

        if (typeof delta.content === 'string' && delta.content.length > 0) {
          send({ type: 'text', delta: delta.content });
        }

        if (Array.isArray(delta.tool_calls)) {
          for (const fragment of delta.tool_calls) {
            const index = fragment.index ?? 0;
            const existing: ToolCallAccumulator = toolCallsAcc.get(index) ?? {
              id: '',
              type: 'function',
              function: { name: '', arguments: '' },
            };
            if (fragment.id) existing.id = fragment.id;
            if (fragment.function?.name) existing.function.name = fragment.function.name;
            if (fragment.function?.arguments) {
              existing.function.arguments += fragment.function.arguments;
            }
            toolCallsAcc.set(index, existing);
          }
        }

        if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
          flushToolCalls();
        }

        // Ответ упёрся в лимит токенов: собранные tool_calls тут заведомо оборваны,
        // отдавать их клиенту нельзя — он выполнит вызов с битым JSON аргументов.
        if (choice.finish_reason === 'length') {
          toolCallsAcc.clear();
          send({
            type: 'error',
            message: 'Ответ модели обрезан по лимиту длины. Попробуйте разбить задачу на шаги.',
          });
          finish();
        }
      };

      // Чанки от fetch не выровнены по границам строк SSE — держим буфер
      // и режем по \n, обрабатывая только полные строки.
      let buffer = '';

      const processLine = (rawLine: string) => {
        const line = rawLine.trim();
        if (line === '' || line.startsWith(':')) return; // пустая строка / keep-alive-комментарий
        if (!line.startsWith('data:')) return;

        const payload = line.slice('data:'.length).trim();
        if (payload === '[DONE]') {
          flushToolCalls();
          finish();
          return;
        }
        processChunk(payload);
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? ''; // последняя строка может быть неполной — оставляем в буфере

          for (const line of lines) {
            processLine(line);
            if (closed) break;
          }
          if (closed) break;
        }

        if (!closed && buffer.trim()) {
          processLine(buffer);
        }
      } catch (error) {
        console.error('[api/agent/chat] Ошибка чтения стрима OpenRouter', error);
        send({ type: 'error', message: 'Соединение с OpenRouter прервалось' });
      } finally {
        finish();
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
