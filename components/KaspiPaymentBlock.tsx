"use client";

import { useState } from "react";

interface KaspiPaymentBlockProps {
  amountLabel?: string;
  /** Полный анонимный session-токен — админ вносит его в панель модерации
   * как есть, поэтому обрезать нельзя (иначе покупка не привяжется к сессии). */
  purposeCode?: string;
}

export function KaspiPaymentBlock({ amountLabel, purposeCode }: KaspiPaymentBlockProps) {
  const phone = process.env.NEXT_PUBLIC_KASPI_PHONE;
  const qrUrl = process.env.NEXT_PUBLIC_KASPI_QR_URL;
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!purposeCode) return;
    await navigator.clipboard.writeText(purposeCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl bg-[#F1F0F5] p-3 text-xs text-[#2A2A2E]">
      {amountLabel && <p className="font-semibold">Сумма: {amountLabel}</p>}

      {qrUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- внешний/статический QR, оптимизация next/image не нужна
        <img src={qrUrl} alt="QR-код для перевода в Kaspi" className="mt-2 h-36 w-36 rounded-lg" />
      ) : (
        <div className="mt-2 flex h-28 w-28 items-center justify-center rounded-lg border border-dashed border-black/20 p-2 text-center text-[10px] text-[#8A8A92]">
          QR появится здесь после настройки NEXT_PUBLIC_KASPI_QR_URL
        </div>
      )}

      {phone ? (
        <p className="mt-2">
          Или переводом на Kaspi по номеру: <strong>{phone}</strong>
        </p>
      ) : (
        <p className="mt-2 text-[#C1554A]">
          Реквизиты Kaspi ещё не настроены (NEXT_PUBLIC_KASPI_PHONE).
        </p>
      )}

      {purposeCode && (
        <div className="mt-2">
          <p>Приложите к оплате ваш код (полностью, для активации покупки):</p>
          <button
            type="button"
            onClick={copyCode}
            className="mt-1 block w-full break-all rounded-lg bg-white px-2 py-1 text-left font-mono text-[10px] shadow-sm"
          >
            {purposeCode} {copied ? "✓ скопировано" : "· нажмите, чтобы скопировать"}
          </button>
        </div>
      )}

      <p className="mt-2 text-[#8A8A92]">
        После оплаты покупка подтверждается администратором вручную — это
        может занять некоторое время.
      </p>
    </div>
  );
}
