interface TLayoutLineOptions {
  values: number[];
  width: number;
  height: number;
  inset: number;   // Room kept clear on every side, so the line and its dots aren't clipped.
  reference?: number;   // A value that must fit the scale too, e.g. a threshold drawn across the chart.
}

export interface TLinePoint {
  x: number;
  y: number;
}

export interface TLineLayout {
  points: TLinePoint[];
  linePath: string;   // Steps: each value holds until the next one, like a balance between days.
  areaPath: string;   // The line closed down to the chart's foot.
  referenceY: number | null;
}

// Geometry for a stepped line chart of `values`, evenly spaced across `width`.
export function layoutLine({ values, width, height, inset, reference }: TLayoutLineOptions): TLineLayout {
  const scaled = reference == null ? values : [...values, reference];
  const max = Math.max(...scaled);
  const min = Math.min(...scaled);
  const span = max - min || Math.abs(max) || 1;
  const top = max === min ? max + span / 2 : max;
  const bottom = max === min ? min - span / 2 : min;

  const plotWidth = width - inset * 2;
  const plotHeight = height - inset * 2;
  const xAt = (index: number) => inset + (values.length > 1 ? (index / (values.length - 1)) * plotWidth : plotWidth / 2);
  const yAt = (value: number) => inset + ((top - value) / (top - bottom)) * plotHeight;

  const points = values.map((value, index) => ({ x: xAt(index), y: yAt(value) }));
  const linePath = points
    .map(({ x, y }, index) => (index === 0 ? `M${x},${y}` : `H${x}V${y}`))
    .join("");
  const areaPath = points.length > 0 ? `${linePath}V${height}H${points[0].x}Z` : "";

  return { points, linePath, areaPath, referenceY: reference == null ? null : yAt(reference) };
}
