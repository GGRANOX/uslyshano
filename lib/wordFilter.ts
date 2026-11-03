// Простой словарь запрещённых слов/сленга (рус/каз) как дополнение к OpenAI
// Moderation API — она слабо покрывает региональный мат и сленг (ТЗ раздел 2,
// раздел 6 Фаза 2). Это стартовый список корней слов, не исчерпывающий —
// расширяйте его силами носителей языка/модераторов по мере необходимости.
//
// Матчинг — два режима (см. ниже): длинные "однозначные" корни ищутся в
// любом месте слова, короткие — только в начале слова или после приставки,
// иначе замазывались обычные слова вроде "учеба", "рубля", "корабля".

// Корни, которые почти не встречаются внутри обычных слов — ищем в любом
// месте слова ("распиздяй", "долбоебизм" и т.п.).
const BANNED_ANYWHERE: string[] = [
  // русский мат и грубые оскорбления (базовые корни)
  "хуй",
  "пизд",
  "мудак",
  "мудил",
  "гандон",
  "долбоеб",
  "долбоёб",
  "пидор",
  "пидар",
  "шлюх",
  "ублюдок",
  // казахские грубые слова/сленг (стартовый набор, требует расширения)
  "қотақ",
  "сігіл",
  "сіктір",
];

// Короткие корни, которые часто сидят внутри приличных слов: "еба" в
// "учеба"/"хлеба", "бля" в "рубля"/"корабля", "хует" в "страхует". Их ищем
// только в начале слова — или сразу после типичной приставки ("заебал",
// "охуел", "выбля..."), — а не где угодно.
const BANNED_AT_START: string[] = ["хуе", "хуё", "хуя", "еба", "ебл", "ебу", "бля", "сучк", "сука", "суки"];

// Приличные слова, которые начинаются с "плохого" корня.
const ALLOWED_STARTS: string[] = ["бляш", "блях"];

const PREFIXES: string[] = [
  "", "за", "на", "до", "по", "от", "у", "вы", "раз", "рас", "при", "про",
  "об", "о", "съ", "из", "пере", "под", "недо", "в", "въ", "с",
];

// Фразы из нескольких слов — проверяются по всему тексту, а не по словам.
const BANNED_PHRASES: string[] = ["боқ ауыз"];

function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е");
}

// Срезаем пунктуацию по краям: "«блять!" -> "блять".
function stripPunctuation(word: string): string {
  return word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
}

const NORMALIZED_ANYWHERE = BANNED_ANYWHERE.map(normalize);
const NORMALIZED_AT_START = BANNED_AT_START.map(normalize);
const NORMALIZED_PHRASES = BANNED_PHRASES.map(normalize);

export function isBannedWord(word: string): boolean {
  const normalized = normalize(stripPunctuation(word));
  if (!normalized) return false;
  if (NORMALIZED_ANYWHERE.some((root) => normalized.includes(root))) return true;
  if (ALLOWED_STARTS.some((ok) => normalized.startsWith(ok))) return false;
  return PREFIXES.some((prefix) =>
    NORMALIZED_AT_START.some((root) => normalized.startsWith(prefix + root))
  );
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
  const normalized = normalize(text);
  if (NORMALIZED_PHRASES.some((phrase) => normalized.includes(phrase))) return true;
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
