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
  AgentChatRequest,
  AgentStreamEvent,
  ChatMessage,
  ToolCall,
  ToolSpec,
} from '@/features/ai-agent/model/contract';

// Роут стримит ответ по мере поступления — кэшировать его нельзя,
// а на Edge-рантайме нет доступа к части Node API, которые могут понадобиться стриму.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/** Переводит HTTP-статус OpenRouter в понятное пользователю сообщение по-русски. */
function upstreamErrorMessage(status: number, detail?: string): string {
  const suffix = detail ? `: ${detail}` : '';
  // `User not found` OpenRouter отдаёт и на provisioning-ключ: такой ключ валиден, но им
  // выпускают другие ключи, а обращаться к моделям нельзя. Подсказываем, иначе поиск причины
  // уходит в проверку биллинга, где всё в порядке.
  if (status === 401) {
    return `Ключ OpenRouter не подходит для обращения к моделям — проверьте, что это inference-ключ, а не provisioning${suffix}`;
  }
  if (status === 402) return `На OpenRouter закончились кредиты${suffix}`;
  if (status === 429) {
    return `OpenRouter: слишком много запросов, подождите и попробуйте снова${suffix}`;
  }
  if (status >= 500) return `OpenRouter временно недоступен${suffix}`;
  return `OpenRouter вернул ошибку (${status})${suffix}`;
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

function isChatRequestBody(value: unknown): value is AgentChatRequest {
  if (!value || typeof value !== 'object') return false;
  return Array.isArray((value as { messages?: unknown }).messages);
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

  if (!isChatRequestBody(rawBody)) {
    return jsonError('Поле messages обязано присутствовать и быть массивом', 400);
  }

  const messages: ChatMessage[] = rawBody.messages;
  const tools: ToolSpec[] = Array.isArray(rawBody.tools) ? rawBody.tools : [];

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
        'HTTP-Referer': request.headers.get('origin') ?? 'https://2brain.local',
        'X-Title': '2brain',
      },
      body: JSON.stringify({
        model,
        messages,
        tools,
        stream: true,
        tool_choice: 'auto',
      }),
    });
  } catch (error) {
    console.error('[api/agent/chat] Не удалось выполнить запрос к OpenRouter', error);
    return jsonError('Не удалось связаться с OpenRouter', 502);
  }

  // Ошибка ДО начала стрима — обычный JSON с корректным HTTP-статусом.
  if (!upstream.ok || !upstream.body) {
    const detail = await readUpstreamErrorDetail(upstream);
    return jsonError(upstreamErrorMessage(upstream.status, detail), upstream.status || 502);
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

      const finish = () => {
        if (closed) return;
        closed = true;
        send({ type: 'done' });
        controller.close();
      };

      // Фрагменты tool_calls копятся по index и собираются в единый вызов,
      // когда стрим сигналит finish_reason или [DONE] — наружу уходит только
      // полностью собранный JSON в arguments, никогда обрывок.
      const toolCallsAcc = new Map<number, ToolCallAccumulator>();

      const flushToolCalls = () => {
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
