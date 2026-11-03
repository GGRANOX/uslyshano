// id стикеров — uuid. Проверяем формат до похода в БД: иначе Postgres
// отвечает ошибкой "invalid input syntax for type uuid", и роут отдаёт 500
// вместо понятного 404.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
