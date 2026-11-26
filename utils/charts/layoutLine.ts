interface TLayoutLineOptions {
  values: number[];
  slots: number;   // Positions across the width; values fill them from the left and may stop short.
  width: number;
  height: number;
  inset: number;   // Room kept clear on every side, so the line and its dots aren't clipped.
  baseline?: number;
}

export interface TLinePoint {
  x: number;
  y: number;
}

export interface TGridline {
  value: number;
  y: number;
}

export interface TLineLayout {
  slotXs: number[];
  points: TLinePoint[];
  linePath: string;
  abovePath: string;   // Between the line and the baseline wherever the line is above it.
  belowPath: string;
  baselineY: number;
  gridlines: TGridline[];
}

const GRID_INTERVALS = 4;

function niceStep(rough: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / magnitude;
  if (fraction <= 1) {
    return magnitude;
  }
  if (fraction <= 2) {
    return 2 * magnitude;
  }
  if (fraction <= 5) {
    return 5 * magnitude;
  }
  return 10 * magnitude;
}

function slotX(index: number, slots: number, width: number, inset: number): number {
  const plotWidth = width - inset * 2;
  return inset + (slots > 1 ? (index / (slots - 1)) * plotWidth : plotWidth / 2);
}

// The slot nearest to `x`, for turning a touch into a value.
export function lineSlotAt(x: number, slots: number, width: number, inset: number): number {
  if (slots <= 1) {
    return 0;
  }
  const index = Math.round(((x - inset) / (width - inset * 2)) * (slots - 1));
  return Math.min(Math.max(index, 0), slots - 1);
}

function areaPath(points: TLinePoint[], baselineY: number): string {
  if (points.length < 2) {
    return "";
  }
  const edge = points.map(({ x, y }) => `L${x},${y}`).join("");
  return `M${points[0].x},${baselineY}${edge}L${points[points.length - 1].x},${baselineY}Z`;
}

// Geometry for a straight-segment line chart of `values`, with the area on each side of `baseline` split exactly
// where the line crosses it.
export function layoutLine({ values, slots, width, height, inset, baseline = 0 }: TLayoutLineOptions): TLineLayout {
  const max = Math.max(baseline, ...values);
  const min = Math.min(baseline, ...values);
  const span = max - min || Math.abs(max) || 1;
  const step = niceStep(span / GRID_INTERVALS);
  const top = Math.max(Math.ceil(max / step) * step, max === min ? min + step : max);
  const bottom = Math.floor(min / step) * step;

  const plotHeight = height - inset * 2;
  const yAt = (value: number) => inset + ((top - value) / (top - bottom)) * plotHeight;
  const baselineY = yAt(baseline);

  const slotXs = Array.from({ length: slots }, (_, index) => slotX(index, slots, width, inset));
  const points = values.map((value, index) => ({ x: slotX(index, slots, width, inset), y: yAt(value) }));
  const linePath = points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x},${y}`).join("");

  const traced: TLinePoint[] = [];
  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (previous && (previous.y - baselineY) * (point.y - baselineY) < 0) {
      const share = (baselineY - previous.y) / (point.y - previous.y);
      traced.push({ x: previous.x + share * (point.x - previous.x), y: baselineY });
    }
    traced.push(point);
  });

  const gridlines = Array.from({ length: Math.round((top - bottom) / step) + 1 }, (_, index) => {
    const value = bottom + index * step;
    return { value, y: yAt(value) };
  });

  return {
    slotXs,
    points,
    linePath,
    abovePath: areaPath(traced.map(({ x, y }) => ({ x, y: Math.min(y, baselineY) })), baselineY),
    belowPath: areaPath(traced.map(({ x, y }) => ({ x, y: Math.max(y, baselineY) })), baselineY),
    baselineY,
    gridlines,
  };
}
