export const SESSION_COOKIE = "stena_session";

// Спонсорские стикеры вставляются вручную админом под этим фиксированным
// "session_id" (см. app/api/admin/sponsored-stickers/route.ts) — не
// настоящая пользовательская сессия, исключается из списка активности в
// /admin (app/admin/page.tsx).
export const SPONSORED_SESSION_ID = "admin-sponsored";

// Анонимный идентификатор сессии — не персональные данные, просто случайная
// строка в httpOnly-cookie (см. ТЗ раздел 2: "без регистрации... анонимный
// session-токен"). Создаётся в middleware.ts на первый визит.
export function generateSessionId(): string {
  return crypto.randomUUID();
}
