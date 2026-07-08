"use client";

import { createBrowserClient } from "@supabase/ssr";

// Только anon key — безопасен для клиента, чтение ограничено RLS-политикой
// "public can read visible stickers" (см. supabase/migrations/0001_init.sql).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
