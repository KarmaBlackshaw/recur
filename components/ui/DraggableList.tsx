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

const SPRING = { damping: 20, stiffness: 200, mass: 0.5 };

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

  const prevDataRef = useRef(data);
  if (prevDataRef.current !== data) {
    prevDataRef.current = data;
    const next = data.map((_, i) => i);
    orderRef.current = next;
    setOrder([...next]);
  }

  // activeVisualIndex: which slot is being dragged (-1 = none)
  const activeVisualIndex = useSharedValue(-1);
  // fingerY: current absolute Y of the finger
  const fingerY = useSharedValue(0);
  // listTop: absolute Y of the top of the list container
  const listTop = useSharedValue(0);

  const reorder = useCallback((from: number, to: number) => {
    const next = [...orderRef.current];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    orderRef.current = next;
    setOrder([...next]);
  }, []);

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
        {order.map((dataIndex, visualIndex) => (
          <DraggableItem
            key={keyExtractor(data[dataIndex])}
            visualIndex={visualIndex}
            activeVisualIndex={activeVisualIndex}
            fingerY={fingerY}
            listTop={listTop}
            itemHeight={itemHeight}
            totalItems={order.length}
            onReorder={reorder}
            onCommit={commit}
          >
            {renderItem(data[dataIndex], dataIndex)}
          </DraggableItem>
        ))}
      </ScrollView>
    </View>
  );
}

interface ItemProps {
  visualIndex: number;
  activeVisualIndex: Animated.SharedValue<number>;
  fingerY: Animated.SharedValue<number>;
  listTop: Animated.SharedValue<number>;
  itemHeight: number;
  totalItems: number;
  onReorder: (from: number, to: number) => void;
  onCommit: () => void;
  children: React.ReactNode;
}

function DraggableItem({
  visualIndex,
  activeVisualIndex,
  fingerY,
  listTop,
  itemHeight,
  totalItems,
  onReorder,
  onCommit,
  children,
}: ItemProps) {
  const gesture = Gesture.Pan()
    .activateAfterLongPress(200)
    .onStart((e) => {
      activeVisualIndex.value = visualIndex;
      fingerY.value = e.absoluteY;
    })
    .onUpdate((e) => {
      if (activeVisualIndex.value !== visualIndex) return;
      fingerY.value = e.absoluteY;

      // Which slot is the finger over right now?
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
    if (!isDragging) {
      return {
        zIndex: 1,
        opacity: 1,
        transform: [{ translateY: 0 }, { scale: withSpring(1, SPRING) }],
      };
    }

    // Keep the item under the finger: finger pos relative to where this slot sits
    const slotTop = listTop.value + visualIndex * itemHeight;
    const offset = fingerY.value - slotTop - itemHeight / 2;

    return {
      zIndex: 100,
      opacity: 0.88,
      transform: [
        { translateY: offset },
        { scale: withSpring(1.03, SPRING) },
      ],
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
