import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Easing, View } from 'react-native';

// Glare — a diagonal highlight sweep that fires `count` times in a
// short burst whenever `runKey` changes to a new truthy value. There
// is no idle animation: when `runKey` is undefined / 0, the component
// is silent. Used to draw the user's eye to a CTA right after they
// navigate to it (e.g. workshop "+" → home), without nagging them
// with a permanent shimmer.
//
// Renders as absoluteFill over its parent. Place as the first child
// of a card with a solid background so the sweep sits on top of the
// fill but below the card's icon / text. `radius` matches the
// parent's borderRadius so the sweep stays clipped to rounded
// corners. `pointerEvents="none"` keeps the wrapper touch-
// transparent so the underlying TouchableOpacity still gets presses.
export default function Glare({
  radius = 0,
  runKey,
  count = 2,
  duration = 900,
  gap = 260,
  color = 'rgba(255,255,255,0.55)',
  sweepWidth = 80,
  angle = '-22deg',
}) {
  const x = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  // Tracks the last runKey we've actually animated for, so subsequent
  // width / dep updates don't restart the burst mid-flight.
  const lastRunRef = useRef(null);

  useEffect(() => {
    if (!runKey || !width) return;
    if (lastRunRef.current === runKey) return;
    lastRunRef.current = runKey;

    // Build the sweep sequence — `count` sweeps with a brief reset +
    // delay between each. Each iteration snaps x back to 0 before
    // animating to 1 so the bar always starts off-screen-left.
    const segments = [];
    for (let i = 0; i < count; i++) {
      segments.push(
        Animated.timing(x, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(x, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      );
      if (i < count - 1) segments.push(Animated.delay(gap));
    }

    // Fire-and-forget — no `return () => seq.stop()`. If we stopped on
    // cleanup, the parent resetting `runKey` to 0 mid-flight (to
    // prevent re-fires on later home arrivals) would abort the
    // animation. Without cleanup, the in-flight sweep keeps going and
    // dies harmlessly with its View when the screen unmounts.
    Animated.sequence(segments).start();
  }, [runKey, width, count, duration, gap]);

  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [-sweepWidth - 40, width + 40],
  });

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[StyleSheet.absoluteFillObject, { borderRadius: radius, overflow: 'hidden' }]}
      pointerEvents="none"
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: -40, bottom: -40,
          width: sweepWidth,
          backgroundColor: color,
          transform: [{ translateX }, { skewX: angle }],
        }}
      />
    </View>
  );
}
