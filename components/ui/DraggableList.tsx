import React, { useCallback, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface DraggableListProps<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  onReorder: (data: T[]) => void;
  itemHeight: number;
  contentContainerStyle?: object;
}

const SPRING = { damping: 22, stiffness: 220, mass: 0.4 };

// Registry so parent can drive each item's offsetY shared value
type OffsetRegistry = Map<string, Animated.SharedValue<number>>;

export function DraggableList<T>({
  data,
  keyExtractor,
  renderItem,
  onReorder,
  itemHeight,
  contentContainerStyle,
}: DraggableListProps<T>) {
  const [order, setOrder] = useState<number[]>(() => data.map((_, i) => i));
  const orderRef = useRef(order);
  const registry = useRef<OffsetRegistry>(new Map());

  const prevDataRef = useRef(data);
  if (prevDataRef.current !== data) {
    prevDataRef.current = data;
    const next = data.map((_, i) => i);
    orderRef.current = next;
    setOrder([...next]);
  }

  const activeVisualIndex = useSharedValue(-1);
  const fingerY = useSharedValue(0);
  const listTop = useSharedValue(0);

  const reorder = useCallback(
    (from: number, to: number) => {
      const next = [...orderRef.current];

      // Slide displaced items by one slot
      if (from < to) {
        for (let vi = from + 1; vi <= to; vi++) {
          const key = keyExtractor(data[next[vi]]);
          const sv = registry.current.get(key);
          if (sv) {
            sv.value = -itemHeight;
            sv.value = withSpring(0, SPRING);
          }
        }
      } else {
        for (let vi = to; vi < from; vi++) {
          const key = keyExtractor(data[next[vi]]);
          const sv = registry.current.get(key);
          if (sv) {
            sv.value = itemHeight;
            sv.value = withSpring(0, SPRING);
          }
        }
      }

      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      orderRef.current = next;
      setOrder([...next]);
    },
    [data, itemHeight, keyExtractor]
  );

  const commit = useCallback(() => {
    onReorder(orderRef.current.map((i) => data[i]));
  }, [data, onReorder]);

  return (
    <View
      onLayout={(e) => {
        listTop.value = e.nativeEvent.layout.y;
      }}
    >
      <ScrollView contentContainerStyle={contentContainerStyle} scrollEnabled>
        {order.map((dataIndex, visualIndex) => {
          const item = data[dataIndex];
          if (!item) return null;
          const key = keyExtractor(item);
          return (
            <DraggableItem
              key={key}
              itemKey={key}
              visualIndex={visualIndex}
              activeVisualIndex={activeVisualIndex}
              fingerY={fingerY}
              listTop={listTop}
              registry={registry.current}
              itemHeight={itemHeight}
              totalItems={order.length}
              onReorder={reorder}
              onCommit={commit}
            >
              {renderItem(item, dataIndex)}
            </DraggableItem>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface ItemProps {
  itemKey: string;
  visualIndex: number;
  activeVisualIndex: Animated.SharedValue<number>;
  fingerY: Animated.SharedValue<number>;
  listTop: Animated.SharedValue<number>;
  registry: OffsetRegistry;
  itemHeight: number;
  totalItems: number;
  onReorder: (from: number, to: number) => void;
  onCommit: () => void;
  children: React.ReactNode;
}

function DraggableItem({
  itemKey,
  visualIndex,
  activeVisualIndex,
  fingerY,
  listTop,
  registry,
  itemHeight,
  totalItems,
  onReorder,
  onCommit,
  children,
}: ItemProps) {
  const offsetY = useSharedValue(0);

  // Register this item's shared value so the parent can drive it
  registry.set(itemKey, offsetY);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(200)
    .onStart((e) => {
      activeVisualIndex.value = visualIndex;
      fingerY.value = e.absoluteY;
    })
    .onUpdate((e) => {
      if (activeVisualIndex.value !== visualIndex) return;
      fingerY.value = e.absoluteY;

      const relY = e.absoluteY - listTop.value;
      const targetIndex = Math.max(
        0,
        Math.min(totalItems - 1, Math.floor(relY / itemHeight))
      );

      if (targetIndex !== activeVisualIndex.value) {
        runOnJS(onReorder)(activeVisualIndex.value, targetIndex);
        activeVisualIndex.value = targetIndex;
      }
    })
    .onEnd(() => {
      activeVisualIndex.value = -1;
      runOnJS(onCommit)();
    })
    .onFinalize(() => {
      if (activeVisualIndex.value !== -1) {
        activeVisualIndex.value = -1;
        runOnJS(onCommit)();
      }
    });

  const style = useAnimatedStyle(() => {
    const isDragging = activeVisualIndex.value === visualIndex;

    if (isDragging) {
      const slotTop = listTop.value + visualIndex * itemHeight;
      const dragOffset = fingerY.value - slotTop - itemHeight / 2;
      return {
        zIndex: 100,
        opacity: 0.88,
        transform: [{ translateY: dragOffset }, { scale: withSpring(1.03, SPRING) }],
      };
    }

    return {
      zIndex: 1,
      opacity: 1,
      transform: [{ translateY: offsetY.value }, { scale: 1 }],
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
