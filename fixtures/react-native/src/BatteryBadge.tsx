/**
 * The boat's battery level, read from a native module of the app's own (`NativeModules.HarbourBattery`): on a phone,
 * native code answers; in a browser nothing does, so its stories stand in for the module.
 *
 * @module
 */
import { type ReactNode, useEffect, useState } from "react";
import { NativeModules, Text } from "react-native";

/** The native module, as the app's native code registers it. */
export type HarbourBatteryModule = {
  /** The battery's level, from 0 to 1. */
  readonly getLevel: () => Promise<number>;
};

/** The badge's props. */
export type BatteryBadgeProps = {
  /** What comes before the level. */
  readonly label?: string;
};

/**
 * The battery's level.
 *
 * @param props - the badge's props.
 */
export const BatteryBadge = ({ label = "Battery" }: BatteryBadgeProps): ReactNode => {
  const [level, setLevel] = useState<number | undefined>(undefined);
  // React Native types its native modules as any: the app says what this one is
  const native: HarbourBatteryModule | undefined = NativeModules["HarbourBattery"];
  useEffect(() => {
    void native?.getLevel().then(setLevel);
  }, [native]);
  if (native === undefined) return <Text testID="battery">{`${label}: no native module`}</Text>;
  return (
    <Text testID="battery">{level === undefined ? `${label}…` : `${label} ${Math.round(level * 100)}%`}</Text>
  );
};
