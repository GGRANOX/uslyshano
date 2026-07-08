// Раскладка стикеров на холсте: "свободно разбросаны... не жёсткая сетка"
// (ТЗ раздел 4). x храним в процентах ширины (холст адаптивный, без
// горизонтального скролла), y — в логических пикселях от начала холста,
// чтобы высота холста могла расти, не сдвигая уже расставленные стикеры.
//
// REFERENCE_WIDTH нужен только чтобы переводить x% в px для проверки
// наложений — на реальный рендер не влияет.
const REFERENCE_WIDTH = 1200;
export const CARD_WIDTH = 260;
export const CARD_HEIGHT = 170;
const PADDING = 24;
export const MIN_CANVAS_HEIGHT = 900;
const MAX_ATTEMPTS = 30;

export interface ExistingPosition {
  position_x: number;
  position_y: number;
}

export function computeCanvasHeight(existing: ExistingPosition[]): number {
  const maxBottom = existing.reduce(
    (max, s) => Math.max(max, s.position_y + CARD_HEIGHT),
    0
  );
  return Math.max(MIN_CANVAS_HEIGHT, maxBottom + PADDING * 2);
}

function toPxRect(xPercent: number, y: number) {
  const x = (xPercent / 100) * REFERENCE_WIDTH;
  return { left: x, right: x + CARD_WIDTH, top: y, bottom: y + CARD_HEIGHT };
}

function overlapArea(a: ReturnType<typeof toPxRect>, b: ReturnType<typeof toPxRect>) {
  const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return xOverlap * yOverlap;
}

export interface PickedPosition {
  position_x: number;
  position_y: number;
  rotation: number;
}

// Несколько попыток подобрать свободное место, затем допускаем лёгкое
// наложение — берём попытку с наименьшей суммарной площадью пересечения
// (ТЗ раздел 6, Фаза 1).
export function pickStickerPosition(existing: ExistingPosition[]): PickedPosition {
  const canvasHeight = computeCanvasHeight(existing);
  const paddingPercent = (PADDING / REFERENCE_WIDTH) * 100;
  const maxXPercent = 100 - (CARD_WIDTH / REFERENCE_WIDTH) * 100 - paddingPercent;

  let bestCandidate = { x: paddingPercent, y: PADDING, overlap: Infinity };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const x = paddingPercent + Math.random() * Math.max(0, maxXPercent - paddingPercent);
    const y = PADDING + Math.random() * Math.max(0, canvasHeight - CARD_HEIGHT - PADDING * 2);
    const candidateRect = toPxRect(x, y);

    const totalOverlap = existing.reduce(
      (sum, s) => sum + overlapArea(candidateRect, toPxRect(s.position_x, s.position_y)),
      0
    );

    if (totalOverlap === 0) {
      return { position_x: x, position_y: y, rotation: randomRotation() };
    }

    if (totalOverlap < bestCandidate.overlap) {
      bestCandidate = { x, y, overlap: totalOverlap };
    }
  }

  return { position_x: bestCandidate.x, position_y: bestCandidate.y, rotation: randomRotation() };
}

function randomRotation(): number {
  return Math.round((Math.random() * 12 - 6) * 10) / 10; // -6..6 градусов
}
