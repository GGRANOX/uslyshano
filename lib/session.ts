export const SESSION_COOKIE = "stena_session";

// Анонимный идентификатор сессии — не персональные данные, просто случайная
// строка в httpOnly-cookie (см. ТЗ раздел 2: "без регистрации... анонимный
// session-токен"). Создаётся в middleware.ts на первый визит.
export function generateSessionId(): string {
  return crypto.randomUUID();
}
