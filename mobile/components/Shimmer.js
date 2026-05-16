import { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { S, R } from '../utils/theme';

// Shimmer placeholder — fills a rectangular area with a moving highlight
// sweep, used while AI/network produces the real content. Replaces the
// classic blinking cursor with something that hints "content is coming
// to this exact spot."
//
// Width is set by the parent. The internal highlight bar is 35% of width
// and travels left → right on a 1.4s loop with cubic-bezier easing.
export default function Shimmer({
  width = '100%',
  height = 16,
  radius = R.small,
  style,
}) {
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 320],
  });

  return (
    <View style={[styles.base, { width, height, borderRadius: radius }, style]}>
      <Animated.View
        style={[
          styles.sweep,
          { transform: [{ translateX }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: S.surfaceSunken,
    overflow: 'hidden',
  },
  sweep: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 120,
    backgroundColor: 'rgba(255,255,255,0.7)',
    opacity: 0.6,
  },
});
