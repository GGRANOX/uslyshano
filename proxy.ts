import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, generateSessionId } from "@/lib/session";

export function proxy(request: NextRequest) {
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
