// Клиентская часть Cloudflare Turnstile (серверная — lib/turnstile.ts).
//
// Один невидимый виджет на всю страницу, токен берётся по запросу:
// getTurnstileToken() перед отправкой поста или жалобы. Обычно пользователь
// ничего не видит; если Cloudflare сомневается, по центру экрана появляется
// короткая проверка (appearance: "interaction-only"). Токен одноразовый,
// поэтому после каждого использования виджет сбрасывается.
//
// Без NEXT_PUBLIC_TURNSTILE_SITE_KEY возвращает null — капча выключена
// (локальная разработка), сервер в этом случае её тоже не требует.

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_TIMEOUT_MS = 60_000;

let scriptPromise: Promise<TurnstileApi> | null = null;
let widgetId: string | null = null;
let container: HTMLDivElement | null = null;
let pending: { resolve: (token: string) => void; reject: (error: Error) => void } | null = null;
// Запросы токена идут строго по очереди — у виджета одна "попытка" за раз.
let queue: Promise<unknown> = Promise.resolve();

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile не загрузился"));
    };
    script.onerror = () => {
      scriptPromise = null; // дать шанс повторить при следующей попытке
      reject(new Error("Не удалось загрузить проверку Cloudflare"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function settle(token: string | null, error?: Error) {
  const current = pending;
  pending = null;
  if (!current) return;
  if (token) current.resolve(token);
  else current.reject(error ?? new Error("Проверка не пройдена"));
}

function ensureWidget(api: TurnstileApi): string {
  if (widgetId) return widgetId;

  container = document.createElement("div");
  // Видно только если Cloudflare попросит взаимодействие.
  container.style.cssText =
    "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9999;";
  document.body.appendChild(container);

  widgetId = api.render(container, {
    sitekey: SITE_KEY,
    execution: "execute",
    appearance: "interaction-only",
    language: "ru",
    callback: (token: string) => settle(token),
    "error-callback": () => {
      settle(null, new Error("Проверка Cloudflare не пройдена"));
      return true; // ошибку обработали сами — не логировать в консоль повторно
    },
    "expired-callback": () => {},
  });
  return widgetId;
}

async function requestToken(): Promise<string> {
  const api = await loadScript();
  const id = ensureWidget(api);

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      settle(null, new Error("Проверка Cloudflare заняла слишком долго"));
    }, TOKEN_TIMEOUT_MS);

    pending = {
      resolve: (token) => {
        clearTimeout(timeout);
        resolve(token);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    };

    api.reset(id);
    api.execute(id);
  });
}

export async function getTurnstileToken(): Promise<string | null> {
  if (!SITE_KEY || typeof window === "undefined") return null;
  const next = queue.then(requestToken, requestToken);
  queue = next.catch(() => undefined);
  return next;
}
