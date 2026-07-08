import { createClient } from "@supabase/supabase-js";

// Anon key, только чтение (ограничено RLS). Безопасен для использования
// в Server Components — это не тот ключ, который нельзя раскрывать.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
