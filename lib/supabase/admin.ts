import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service role key обходит RLS — использовать ТОЛЬКО внутри Route Handlers
// и Edge Functions. Импорт "server-only" сломает сборку, если этот файл
// случайно попадёт в клиентский бандл (частая ошибка с Supabase — см. ТЗ раздел 2).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Не заданы NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — заполните .env.local по образцу .env.example"
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
