import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, generateSessionId } from "@/lib/session";

// Простая админ-панель, защищённая паролем (ТЗ раздел 6, Фаза 2). HTTP Basic
// Auth достаточен для MVP — работает из коробки в браузере, не требует своей
// формы логина/сессии. Безопасен только при HTTPS (Vercel даёт его по
// умолчанию) — по HTTP заголовок Authorization ходит в открытом виде.
function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

function isAuthorizedAdmin(request: NextRequest): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false; // не настроено — доступ закрыт по умолчанию

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    decoded = atob(header.slice("Basic ".length));
  } catch {
    return false; // битый base64 — раньше это роняло proxy с 500
  }
  const separatorIndex = decoded.indexOf(":");
  const providedPassword = separatorIndex === -1 ? decoded : decoded.slice(separatorIndex + 1);

  return constantTimeEqual(providedPassword, password);
}

// Сравнение за постоянное время: обычный === останавливается на первом
// несовпавшем символе, и по времени ответа пароль теоретически можно
// подбирать посимвольно. Без node:crypto, чтобы работало в любом рантайме.
function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < bBytes.length; i++) {
    diff |= (aBytes[i % Math.max(aBytes.length, 1)] ?? 0) ^ bBytes[i];
  }
  return diff === 0;
}

function requireAdminAuth(): NextResponse {
  // Значения HTTP-заголовков ограничены ByteString (Latin1) — кириллица в
  // WWW-Authenticate ломает Response на Edge Runtime, поэтому realm латиницей.
  return new NextResponse("Требуется авторизация администратора.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Stena Admin"' },
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminPath(pathname) && !isAuthorizedAdmin(request)) {
    return requireAdminAuth();
  }

  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  if (existing) {
    return NextResponse.next();
  }

  const sessionId = generateSessionId();

  // Прокидываем cookie и в исходящий request (чтобы Server Component в этом
  // же цикле уже видел сессию), и в response (чтобы браузер её сохранил).
  const requestHeaders = new Headers(request.headers);
  const forwardedCookie = `${SESSION_COOKIE}=${sessionId}`;
  const existingCookieHeader = requestHeaders.get("cookie");
  requestHeaders.set(
    "cookie",
    existingCookieHeader ? `${existingCookieHeader}; ${forwardedCookie}` : forwardedCookie
  );

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
