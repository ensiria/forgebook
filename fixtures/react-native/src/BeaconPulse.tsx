/**
 * A harbour beacon that pulses, animated with Reanimated: a shared value driven by `withRepeat` and `withTiming`, read
 * in a worklet by `useAnimatedStyle`, which Reanimated's Babel plugin compiles.
 *
 * @module
 */
import { type ReactNode, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";

/** The beacon's props. */
export type BeaconPulseProps = {
  /** How long one pulse takes, in milliseconds; 900 by default. */
  readonly period?: number;
  /** The beacon's colour; the harbour's blue by default. */
  readonly color?: string;
};

/**
 * A pulsing beacon.
 *
 * @param props - the beacon's props.
 */
export const BeaconPulse = ({ period = 900, color = "#2a6f97" }: BeaconPulseProps): ReactNode => {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: period, easing: Easing.out(Easing.quad) }), -1, false);
  }, [period, pulse]);
  const ring = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value,
    transform: [{ scale: 1 + pulse.value }]
  }));
  return (
    <View style={styles.box}>
      <Animated.View testID="beacon-ring" style={[styles.dot, { backgroundColor: color }, ring]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  box: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", width: 32, height: 32, borderRadius: 16 }
});
