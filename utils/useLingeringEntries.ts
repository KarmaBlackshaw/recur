import { useEffect, useMemo, useState } from "react";

const LINGER_MS = 1200;

type Lingering<T> = { item: T; until: number };

// Keeps entries that just dropped out of `items` (and match `shouldLinger`) for LINGER_MS,
// so e.g. a card marked paid shows its Paid state before leaving the list.
// The drop is detected during render (not in an effect) so the row never unmounts in between.
export function useLingeringEntries<T extends { key: string }>(items: T[], shouldLinger: (item: T) => boolean): T[] {
  const [prevItems, setPrevItems] = useState(items);
  const [lingering, setLingering] = useState<Lingering<T>[]>([]);

  if (items !== prevItems) {
    const liveKeys = new Set(items.map(({ key }) => key));
    const dropped = prevItems.filter((i) => !liveKeys.has(i.key) && shouldLinger(i));
    setPrevItems(items);
    if (dropped.length) {
      const until = Date.now() + LINGER_MS;
      const droppedKeys = new Set(dropped.map(({ key }) => key));
      setLingering((l) => [...l.filter(({ item }) => !droppedKeys.has(item.key)), ...dropped.map((item) => ({ item, until }))]);
    }
  }

  useEffect(() => {
    if (!lingering.length) {
      return;
    }
    const nextExpiry = Math.min(...lingering.map(({ until }) => until));
    const timer = setTimeout(
      () => setLingering((l) => l.filter(({ until }) => until > Date.now())),
      Math.max(0, nextExpiry - Date.now())
    );
    return () => clearTimeout(timer);
  }, [lingering]);

  return useMemo(() => {
    const liveKeys = new Set(items.map(({ key }) => key));
    return [...items, ...lingering.filter(({ item }) => !liveKeys.has(item.key)).map(({ item }) => item)];
  }, [items, lingering]);
}
