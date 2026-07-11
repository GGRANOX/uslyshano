// Раскладка стикеров на холсте: свободный 2D-холст фиксированного размера
// ("стенки"), по которому можно таскать вьюпорт в любую сторону — не
// бесконечный, но больше экрана. position_x/position_y — абсолютные px в
// системе координат холста (0,0 — левый верхний угол).
export const CARD_WIDTH = 260;
export const CARD_HEIGHT = 170;
const PADDING = 24;
export const CANVAS_WIDTH = 3000;
export const CANVAS_HEIGHT = 3000;
const MAX_ATTEMPTS = 30;

export interface ExistingPosition {
  position_x: number;
  position_y: number;
}

function toRect(x: number, y: number) {
  return { left: x, right: x + CARD_WIDTH, top: y, bottom: y + CARD_HEIGHT };
}

function overlapArea(a: ReturnType<typeof toRect>, b: ReturnType<typeof toRect>) {
  const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return xOverlap * yOverlap;
}

export interface PickedPosition {
  position_x: number;
  position_y: number;
  rotation: number;
}

// Несколько попыток подобрать свободное место в границах холста, затем
// допускаем лёгкое наложение — берём попытку с наименьшей суммарной
// площадью пересечения (ТЗ раздел 6, Фаза 1).
export function pickStickerPosition(existing: ExistingPosition[]): PickedPosition {
  const maxX = CANVAS_WIDTH - CARD_WIDTH - PADDING;
  const maxY = CANVAS_HEIGHT - CARD_HEIGHT - PADDING;

  let bestCandidate = { x: PADDING, y: PADDING, overlap: Infinity };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const x = PADDING + Math.random() * Math.max(0, maxX - PADDING);
    const y = PADDING + Math.random() * Math.max(0, maxY - PADDING);
    const candidateRect = toRect(x, y);

    const totalOverlap = existing.reduce(
      (sum, s) => sum + overlapArea(candidateRect, toRect(s.position_x, s.position_y)),
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
