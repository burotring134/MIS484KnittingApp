import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { S, R } from '../utils/theme';

// Liquid Glass panel — frosted blur background, hairline highlight stroke,
// translucent tint overlay. Default radius is `expressive`; pass any radius
// from the R scale for a different feel. `tone` picks the tint layer.
//
// Usage:
//   <Glass tone="light" radius={R.expressive} style={{ padding: 18 }}>...</Glass>
//
// Renders as a stack: BlurView → tint overlay → children. The wrapper
// owns the radius + overflow:hidden so children don't have to clip
// themselves.
export default function Glass({
  children,
  tone = 'light',          // 'light' | 'rose' | 'mauve' | 'sage' | 'tint'
  radius = R.expressive,
  intensity = 50,
  blurTint = 'light',      // 'light' | 'dark' — BlurView system tint
  style,
  bordered = true,
}) {
  const tintColor =
      tone === 'rose'  ? S.glassRose
    : tone === 'mauve' ? S.glassMauve
    : tone === 'sage'  ? S.glassSage
    : tone === 'tint'  ? S.glassTint
    :                    S.glassLight;

  // Split the user style into layout-affecting (passed to wrap) and
  // child-affecting (passed to content). Without this split, alignItems
  // on the wrap can't reach the children — they live one View deeper.
  const flat = StyleSheet.flatten(style) || {};
  const {
    width, height, minWidth, minHeight, maxWidth, maxHeight,
    margin, marginTop, marginBottom, marginLeft, marginRight,
    marginHorizontal, marginVertical, alignSelf, flex, flexGrow, flexShrink,
    ...inner
  } = flat;
  const outer = {
    width, height, minWidth, minHeight, maxWidth, maxHeight,
    margin, marginTop, marginBottom, marginLeft, marginRight,
    marginHorizontal, marginVertical, alignSelf, flex, flexGrow, flexShrink,
  };

  return (
    <View
      style={[
        styles.wrap,
        { borderRadius: radius },
        bordered && styles.bordered,
        outer,
      ]}
    >
      <BlurView intensity={intensity} tint={blurTint} style={StyleSheet.absoluteFill}/>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]}/>
      <View style={[styles.content, inner]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  bordered: {
    borderWidth: 1,
    borderColor: S.glassStroke,
  },
  content: {
    flex: 1,
  },
});
