export interface TBarRect {
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

export function layoutBars({ groups, width, height }: {
  groups: readonly (readonly number[])[];
  width: number;
  height: number;
}): { slots: TBarSlot[]; max: number } {
  const max = Math.max(0, ...groups.flat());
  const slotWidth = width / groups.length;
  const slots = groups.map((values, index) => {
    const x = index * slotWidth;
    const barWidth = (slotWidth * (1 - 2 * SLOT_PADDING)) / values.length;
    const bars = values.map((value, barIndex) => {
      const barHeight = value > 0 ? Math.max(MIN_BAR_HEIGHT, (value / max) * height) : 0;
      return { x: x + slotWidth * SLOT_PADDING + barIndex * barWidth, y: height - barHeight, width: barWidth, height: barHeight };
    });
    return { x, width: slotWidth, bars };
  });
  return { slots, max };
}
