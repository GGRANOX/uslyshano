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

// Первые CENTER_CLUSTER_COUNT стикеров появляются кучкой у центра холста —
// именно там стартует pan в WallCanvas, — а не в случайной точке всего
// 3000x3000, иначе новая (пустая) доска выглядит как баг. Позиция внутри
// этой области всё равно случайная, не сетка. После порога — обычный
// разброс по всему холсту.
const CENTER_CLUSTER_COUNT = 13;
const CENTER_CLUSTER_HALF_WIDTH = 500;
const CENTER_CLUSTER_HALF_HEIGHT = 350;

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
  const useCenterCluster = existing.length < CENTER_CLUSTER_COUNT;

  const fullMaxX = CANVAS_WIDTH - CARD_WIDTH - PADDING;
  const fullMaxY = CANVAS_HEIGHT - CARD_HEIGHT - PADDING;

  const minX = useCenterCluster
    ? Math.max(PADDING, CANVAS_WIDTH / 2 - CENTER_CLUSTER_HALF_WIDTH)
    : PADDING;
  const maxX = useCenterCluster
    ? Math.min(fullMaxX, CANVAS_WIDTH / 2 + CENTER_CLUSTER_HALF_WIDTH - CARD_WIDTH)
    : fullMaxX;
  const minY = useCenterCluster
    ? Math.max(PADDING, CANVAS_HEIGHT / 2 - CENTER_CLUSTER_HALF_HEIGHT)
    : PADDING;
  const maxY = useCenterCluster
    ? Math.min(fullMaxY, CANVAS_HEIGHT / 2 + CENTER_CLUSTER_HALF_HEIGHT - CARD_HEIGHT)
    : fullMaxY;

  let bestCandidate = { x: minX, y: minY, overlap: Infinity };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const x = minX + Math.random() * Math.max(0, maxX - minX);
    const y = minY + Math.random() * Math.max(0, maxY - minY);
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
