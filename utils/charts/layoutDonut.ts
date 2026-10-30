export const DONUT_LABEL_HEIGHT = 30;

const GAP = 2;
const LEADER = 16;
const VERTICAL_ROOM = 44;
const SIDE_GUTTER = 8;
const LABEL_MARGIN = 4;

type TDonutSide = "left" | "right";

const SIDES: TDonutSide[] = ["left", "right"];

interface TLayoutDonutOptions {
  values: number[];
  width: number;
  radius: number;
  thickness: number;
}

export interface TDonutSlice {
  arcPath: string;
  leaderPath: string;
  side: TDonutSide;
  labelX: number;
  labelY: number;
}

export interface TDonutLayout {
  height: number;
  centerX: number;
  centerY: number;
  labelWidth: number;
  slices: TDonutSlice[];
}

// Keeps each label as close to its slice as it can while no two touch: push down past the one above, then back up from the bottom edge.
function spreadLabels(desired: number[], top: number, bottom: number) {
  const spread = [...desired];
  spread.forEach((y, index) => {
    spread[index] = Math.max(y, index === 0 ? top : spread[index - 1] + DONUT_LABEL_HEIGHT);
  });
  for (let index = spread.length - 1; index >= 0; index -= 1) {
    const limit = index === spread.length - 1 ? bottom : spread[index + 1] - DONUT_LABEL_HEIGHT;
    spread[index] = Math.min(spread[index], limit);
  }
  return spread;
}

// Angles are degrees clockwise from 12 o'clock. Each slice is a stroked arc on the ring's mid radius, so the hole needs no drawing.
export function layoutDonut({ values, width, radius, thickness }: TLayoutDonutOptions): TDonutLayout {
  const height = radius * 2 + VERTICAL_ROOM * 2;
  const centerX = width / 2;
  const centerY = height / 2;
  const midRadius = radius - thickness / 2;
  const gapAngle = ((GAP / 2 / midRadius) * 180) / Math.PI;
  const total = values.reduce((sum, value) => sum + value, 0);

  const point = (angle: number, distance: number) => {
    const radians = (angle * Math.PI) / 180;
    return `${(centerX + distance * Math.sin(radians)).toFixed(2)} ${(centerY - distance * Math.cos(radians)).toFixed(2)}`;
  };

  let angle = 0;
  const wedges = values.map((value) => {
    const start = angle;
    const sweep = (value / total) * 360;
    angle += sweep;
    return { start, sweep, mid: start + sweep / 2 };
  });

  const edgeOf = (side: TDonutSide) => (side === "right" ? centerX + radius + LEADER : centerX - radius - LEADER);
  const sideOf = (mid: number): TDonutSide => (mid <= 180 ? "right" : "left");
  const desiredY = (mid: number) => centerY - (radius + LEADER) * Math.cos((mid * Math.PI) / 180);

  const labelYs = new Map<number, number>();
  for (const side of SIDES) {
    const indexes = wedges
      .map((_, index) => index)
      .filter((index) => sideOf(wedges[index].mid) === side)
      .sort((a, b) => desiredY(wedges[a].mid) - desiredY(wedges[b].mid));
    const spread = spreadLabels(
      indexes.map((index) => desiredY(wedges[index].mid)),
      DONUT_LABEL_HEIGHT / 2,
      height - DONUT_LABEL_HEIGHT / 2
    );
    indexes.forEach((index, order) => labelYs.set(index, spread[order]));
  }

  const slices = wedges.map(({ start, sweep, mid }, index) => {
    const side = sideOf(mid);
    const edgeX = edgeOf(side);
    const labelY = labelYs.get(index) ?? centerY;
    const inset = sweep > gapAngle * 2 ? gapAngle : 0;
    const arcPath =
      wedges.length === 1
        ? `M ${point(0, midRadius)} A ${midRadius} ${midRadius} 0 1 1 ${point(180, midRadius)} A ${midRadius} ${midRadius} 0 1 1 ${point(360, midRadius)}`
        : `M ${point(start + inset, midRadius)} A ${midRadius} ${midRadius} 0 ${sweep - inset * 2 > 180 ? 1 : 0} 1 ${point(start + sweep - inset, midRadius)}`;
    const leaderPath = `M ${point(mid, radius + 1)} C ${point(mid, radius + LEADER)} ${edgeX + (side === "right" ? -LEADER / 2 : LEADER / 2)} ${labelY} ${edgeX} ${labelY}`;
    return {
      arcPath,
      leaderPath,
      side,
      labelX: edgeX + (side === "right" ? LABEL_MARGIN : -LABEL_MARGIN),
      labelY,
    };
  });

  return {
    height,
    centerX,
    centerY,
    labelWidth: width / 2 - radius - LEADER - LABEL_MARGIN - SIDE_GUTTER,
    slices,
  };
}
