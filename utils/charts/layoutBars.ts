import { orderBy } from "@/utils/collections";

export interface TBarRect {
  series: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TBarSlot {
  x: number;
  width: number;
  bars: TBarRect[];
}

const SLOT_PADDING = 0.15;
const MIN_BAR_HEIGHT = 2;

// A slot's series overlap in one column from the same baseline; bars come in paint order, tallest first, so a shorter one is never hidden.
// On a tie the earlier series paints last, so callers list the series to keep visible first.
export function layoutBars({ groups, width, height }: {
  groups: readonly (readonly number[])[];
  width: number;
  height: number;
}): { slots: TBarSlot[]; max: number } {
  const max = Math.max(0, ...groups.flat());
  const slotWidth = width / groups.length;
  const slots = groups.map((values, index) => {
    const x = index * slotWidth;
    const bars = values.map((value, series) => {
      const barHeight = value > 0 ? Math.max(MIN_BAR_HEIGHT, (value / max) * height) : 0;
      return { series, x: x + slotWidth * SLOT_PADDING, y: height - barHeight, width: slotWidth * (1 - 2 * SLOT_PADDING), height: barHeight };
    });
    return { x, width: slotWidth, bars: orderBy(bars, ["height", "series"], ["desc", "desc"]) };
  });
  return { slots, max };
}
