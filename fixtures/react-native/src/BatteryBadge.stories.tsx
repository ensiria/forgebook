/**
 * The battery badge, whose native module a story stands in for: native code cannot run in a browser.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react-native-web";
import { NativeModules } from "react-native";

import { BatteryBadge, type HarbourBatteryModule } from "./BatteryBadge";

/**
 * Stands in for the native module while a story is shown, and takes it away after.
 *
 * @param level - the level it answers, from 0 to 1.
 */
const withBattery = (level: number) => (): (() => void) => {
  const module: HarbourBatteryModule = { getLevel: async () => level };
  NativeModules["HarbourBattery"] = module;
  return () => {
    Reflect.deleteProperty(NativeModules, "HarbourBattery");
  };
};

export default { title: "Controls/Battery badge", component: BatteryBadge } satisfies Meta<
  typeof BatteryBadge
>;

/** The level the native module answers, stood in for by the story. */
export const Charged: Story<typeof BatteryBadge> = { beforeEach: withBattery(0.82) };

/** Nearly empty. */
export const Low: Story<typeof BatteryBadge> = { beforeEach: withBattery(0.07) };

/** No native module at all, as in a browser without a stand-in: the badge says so instead of failing. */
export const WithoutModule: Story<typeof BatteryBadge> = {};
