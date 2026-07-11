// Простой словарь запрещённых слов/сленга (рус/каз) как дополнение к OpenAI
// Moderation API — она слабо покрывает региональный мат и сленг (ТЗ раздел 2,
// раздел 6 Фаза 2). Это стартовый список корней слов, не исчерпывающий —
// расширяйте его силами носителей языка/модераторов по мере необходимости.
//
// Матчинг — простая проверка вхождения подстроки в нормализованный текст.
// Осознанный компромисс "простого словаря": возможны редкие ложные
// срабатывания на словах, содержащих корень как часть (например, у длинных
// технических терминов) — считаем это приемлемым для MVP.

const BANNED_ROOTS: string[] = [
  // русский мат и грубые оскорбления (базовые корни)
  "хуй",
  "хуе",
  "хует",
  "пизд",
  "ебат",
  "ёбан",
  "еба",
  "бля",
  "мудак",
  "мудил",
  "гандон",
  "долбоеб",
  "долбоёб",
  "пидор",
  "пидар",
  "шлюха",
  "ублюдок",
  "сучка",
  // казахские грубые слова/сленг (стартовый набор, требует расширения)
  "қотақ",
  "сігіл",
  "сіктір",
  "боқ ауыз",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е");
}

function isBannedWord(word: string): boolean {
  const normalized = normalize(word);
  return BANNED_ROOTS.some((root) => normalized.includes(normalize(root)));
}

export interface WordFilterResult {
  flagged: boolean;
  reason?: string;
}

export function checkBannedWords(text: string): WordFilterResult {
  if (!isBannedAnywhere(text)) {
    return { flagged: false };
  }
  return {
    flagged: true,
    reason: "Сообщение содержит запрещённые слова.",
  };
}

function isBannedAnywhere(text: string): boolean {
  return text.split(/\s+/).some(isBannedWord);
}

export interface MaskedSegment {
  text: string;
  masked: boolean;
}

// Публикацию по запрещённым словам больше не блокируем (см.
// app/api/stickers/route.ts) — вместо этого на клиенте (StickerCard)
// замазываем конкретные слова, пока читатель сам не нажмёт на одно из них
// (см. использование в StickerCard.tsx). Разбиваем по пробелам, сохраняя
// сами пробелы/переносы строк как отдельные немаскируемые сегменты.
export function maskBannedWords(text: string): MaskedSegment[] {
  return text.split(/(\s+)/).map((chunk) => ({
    text: chunk,
    masked: chunk.trim().length > 0 && isBannedWord(chunk),
  }));
}
