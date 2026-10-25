// Small, dependency-free stand-ins for the lodash collection helpers the app used.
// They keep lodash's semantics (checked by scripts/collections-check.mjs).

export type Iteratee<T> = keyof T | ((item: T) => unknown);
type Many<V> = V | readonly V[];
type Order = "asc" | "desc";

function toFn<T>(iteratee: Iteratee<T>): (item: T) => unknown {
  return typeof iteratee === "function" ? iteratee : (item) => item[iteratee];
}

function toArray<V>(value: Many<V>): readonly V[] {
  return (Array.isArray(value) ? value : [value]) as readonly V[];
}

// lodash's ascending comparison: relational `<`/`>` (so Dates compare by time), with
// null after values and undefined/NaN last.
function compareAscending(value: unknown, other: unknown): number {
  if (value === other) {
    return 0;
  }
  const valIsDefined = value !== undefined;
  const valIsNull = value === null;
  const valIsReflexive = value === value;
  const othIsDefined = other !== undefined;
  const othIsNull = other === null;
  const othIsReflexive = other === other;
  if (
    (!othIsNull && (value as number) > (other as number)) ||
    (valIsNull && othIsDefined && othIsReflexive) ||
    (!valIsDefined && othIsReflexive) ||
    !valIsReflexive
  ) {
    return 1;
  }
  if (
    (!valIsNull && (value as number) < (other as number)) ||
    (othIsNull && valIsDefined && valIsReflexive) ||
    (!othIsDefined && valIsReflexive) ||
    !othIsReflexive
  ) {
    return -1;
  }
  return 0;
}

function setKey<V>(target: Record<string, V>, key: unknown, value: V) {
  if (key === "__proto__") {
    Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true });
  } else {
    target[key as string] = value;
  }
}

/** Stable sort by one or more iteratees; a missing order defaults to "asc". */
export function orderBy<T>(collection: readonly T[], iteratees: Many<Iteratee<T>>, orders: Many<Order> = []): T[] {
  const fns = toArray(iteratees).map(toFn);
  const directions = toArray(orders);
  return collection
    .map((item, index) => ({ item, index, criteria: fns.map((fn) => fn(item)) }))
    .sort((a, b) => {
      for (let i = 0; i < fns.length; i++) {
        const result = compareAscending(a.criteria[i], b.criteria[i]);
        if (result) {
          return directions[i] === "desc" ? -result : result;
        }
      }
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export function sortBy<T>(collection: readonly T[], iteratees: Many<Iteratee<T>>): T[] {
  return orderBy(collection, iteratees);
}

export function groupBy<T>(collection: readonly T[], iteratee: Iteratee<T>): Record<string, T[]> {
  const fn = toFn(iteratee);
  const result: Record<string, T[]> = {};
  for (const item of collection) {
    const key = fn(item);
    if (Object.prototype.hasOwnProperty.call(result, key as PropertyKey)) {
      result[key as string].push(item);
    } else {
      setKey(result, key, [item]);
    }
  }
  return result;
}

/** Last item wins for a repeated key. */
export function keyBy<T>(collection: readonly T[], iteratee: Iteratee<T>): Record<string, T> {
  const fn = toFn(iteratee);
  const result: Record<string, T> = {};
  for (const item of collection) {
    setKey(result, fn(item), item);
  }
  return result;
}

/** Skips undefined values; an empty collection sums to 0. */
export function sumBy<T>(collection: readonly T[], iteratee: Iteratee<T>): number {
  const fn = toFn(iteratee);
  let total = 0;
  for (const item of collection) {
    const value = fn(item);
    if (value !== undefined) {
      total += value as number;
    }
  }
  return total;
}

/** First item with the greatest value; null, undefined and NaN values are skipped. */
export function maxBy<T>(collection: readonly T[], iteratee: Iteratee<T>): T | undefined {
  const fn = toFn(iteratee);
  let result: T | undefined;
  let computed: unknown;
  for (const item of collection) {
    const current = fn(item);
    if (current != null && (computed === undefined ? current === current : (current as number) > (computed as number))) {
      computed = current;
      result = item;
    }
  }
  return result;
}

export function partition<T>(collection: readonly T[], predicate: (item: T) => unknown): [T[], T[]] {
  const pass: T[] = [];
  const fail: T[] = [];
  for (const item of collection) {
    (predicate(item) ? pass : fail).push(item);
  }
  return [pass, fail];
}

export function uniq<T>(collection: readonly T[]): T[] {
  return [...new Set(collection)];
}

/** Keeps the first item for each key. */
export function uniqBy<T>(collection: readonly T[], iteratee: Iteratee<T>): T[] {
  const fn = toFn(iteratee);
  const seen = new Set<unknown>();
  return collection.filter((item) => {
    const key = fn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function chunk<T>(collection: readonly T[], size: number): T[][] {
  const length = Math.max(Math.trunc(size), 0);
  const chunks: T[][] = [];
  if (length < 1) {
    return chunks;
  }
  for (let i = 0; i < collection.length; i += length) {
    chunks.push(collection.slice(i, i + length));
  }
  return chunks;
}

/** `range(4)` → [0, 1, 2, 3]; `range(1, 4)` → [1, 2, 3]; counts down when end < start. */
export function range(start: number, end?: number): number[] {
  const [from, to] = end === undefined ? [0, start] : [start, end];
  const step = from < to ? 1 : -1;
  const length = Math.max(Math.ceil((to - from) / step), 0);
  return Array.from({ length }, (_, i) => from + i * step);
}
