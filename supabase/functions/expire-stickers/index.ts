// Supabase Edge Function: реально удаляет из БД стикеры с истёкшим expires_at.
// Вызывается по расписанию (см. supabase/functions/expire-stickers/README.md
// для настройки cron через Supabase Dashboard -> Edge Functions -> Cron).
//
// Требует переменные окружения (задаются автоматически в среде Edge Functions):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== cronSecret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Missing Supabase env vars", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase
    .from("stickers")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("expire-stickers failed", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // Заодно чистим события лимитов по IP старше суток (миграция 0010) —
  // они нужны только для окна в 1 час. Ошибка тут не критична.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { error: cleanupError } = await supabase
    .from("rate_limit_events")
    .delete()
    .lt("created_at", dayAgo);
  if (cleanupError) {
    console.error("expire-stickers: rate_limit_events cleanup failed", cleanupError);
  }

  const deletedCount = data?.length ?? 0;
  console.log(`expire-stickers: удалено ${deletedCount} стикеров`);

  return new Response(JSON.stringify({ deleted: deletedCount }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
