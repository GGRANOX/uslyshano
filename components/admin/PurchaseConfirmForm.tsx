"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DecorationInfo } from "@/lib/decorations";

export function PurchaseConfirmForm() {
  const router = useRouter();
  const [decorations, setDecorations] = useState<DecorationInfo[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [decorationId, setDecorationId] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/decorations")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.decorations ?? []) as DecorationInfo[];
        setDecorations(list);
        if (list[0]) setDecorationId(list[0].id);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.trim(), decorationId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "Не удалось подтвердить покупку.");
        return;
      }
      setStatus("done");
      setSessionId("");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Проблема с сетью.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-black/10 bg-white p-4">
      <h2 className="text-sm font-bold text-[#2A2A2E]">Подтвердить покупку декорации</h2>
      <p className="mt-1 text-xs text-[#8A8A92]">
        Вставьте полный код сессии, который пользователь прислал вместе с
        подтверждением оплаты в Kaspi.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          placeholder="Код сессии"
          className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm font-mono"
          required
        />
        <select
          value={decorationId}
          onChange={(e) => setDecorationId(e.target.value)}
          className="rounded-lg border border-black/10 px-3 py-2 text-sm"
        >
          {decorations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} — {d.priceKzt} ₸
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={status === "sending" || !sessionId.trim() || !decorationId}
          className="rounded-lg bg-[#2A2A2E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {status === "sending" ? "..." : "Подтвердить"}
        </button>
      </div>
      {status === "done" && (
        <p className="mt-2 text-xs text-[#1f7a3f]">Покупка подтверждена.</p>
      )}
      {status === "error" && <p className="mt-2 text-xs text-[#C1554A]">{message}</p>}
    </form>
  );
}
