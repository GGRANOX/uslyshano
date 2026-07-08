import "server-only";

const CATEGORY_LABELS_RU: Record<string, string> = {
  sexual: "сексуальный контент",
  "sexual/minors": "сексуальный контент с несовершеннолетними",
  hate: "разжигание ненависти",
  "hate/threatening": "угрозы на почве ненависти",
  harassment: "травля/оскорбления",
  "harassment/threatening": "угрозы и травля",
  "self-harm": "тема самоповреждения",
  "self-harm/intent": "тема самоповреждения",
  "self-harm/instructions": "инструкции по самоповреждению",
  violence: "сцены насилия",
  "violence/graphic": "натуралистичное насилие",
  illicit: "противоправные действия",
  "illicit/violent": "противоправные действия с насилием",
};

export interface ModerationResult {
  flagged: boolean;
  reason?: string;
}

// Каждый текст перед сохранением проверяется через OpenAI Moderation API
// (ТЗ раздел 6, Фаза 1 — обязательно, не откладывается).
export async function moderateText(text: string): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY не задан — заполните .env.local");
  }

  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI Moderation API вернул ${response.status}: ${body}`);
  }

  const data = await response.json();
  const result = data.results?.[0];

  if (!result) {
    throw new Error("OpenAI Moderation API вернул пустой ответ");
  }

  if (!result.flagged) {
    return { flagged: false };
  }

  const triggeredCategories = Object.entries(result.categories as Record<string, boolean>)
    .filter(([, isFlagged]) => isFlagged)
    .map(([category]) => CATEGORY_LABELS_RU[category] ?? category);

  const reason =
    triggeredCategories.length > 0
      ? `Сообщение не прошло модерацию: обнаружено — ${triggeredCategories.join(", ")}.`
      : "Сообщение не прошло модерацию.";

  return { flagged: true, reason };
}
