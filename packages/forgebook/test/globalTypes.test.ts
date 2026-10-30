/**
 * Tests for the catalogue's switches made from Storybook's `globalTypes`.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { switchesFromGlobalTypes, switchesProblem } from "../src/switches.ts";

/** A preview's `globalTypes`, as Storybook's docs write them. */
const GLOBAL_TYPES = {
  theme: {
    description: "Global theme for components",
    toolbar: { title: "Theme", icon: "circlehollow", items: ["light", "dark"], dynamicTitle: true }
  },
  density: {
    name: "Density",
    defaultValue: "compact",
    toolbar: {
      items: [
        { value: "comfortable", title: "Comfortable" },
        { value: "compact", title: "Compact", right: "C" },
        { type: "reset", title: "Reset" }
      ]
    }
  },
  backgrounds: { toolbar: { items: ["light"] } },
  width: { toolbar: { items: ["narrow"] } },
  user: { description: "No toolbar: not a switch" }
};

describe("switchesFromGlobalTypes", () => {
  it("makes a code switch per globalType with toolbar items, leaving out addons' and the address's names", () => {
    const switches = switchesFromGlobalTypes(GLOBAL_TYPES, { initialGlobals: { theme: "dark" } });
    expect(switches).toEqual([
      {
        id: "theme",
        label: "Theme",
        values: [
          { value: "light", label: "light" },
          { value: "dark", label: "dark" }
        ],
        default: "dark",
        apply: { kind: "code" }
      },
      {
        id: "density",
        label: "Density",
        values: [
          { value: "comfortable", label: "Comfortable" },
          { value: "compact", label: "Compact" }
        ],
        default: "compact",
        apply: { kind: "code" }
      }
    ]);
    expect(switchesProblem(switches)).toBeUndefined();
  });

  it("takes where a switch applies and its role from the overrides, and the first value without a known default", () => {
    const [theme] = switchesFromGlobalTypes(GLOBAL_TYPES, {
      initialGlobals: { theme: "sepia" },
      overrides: { theme: { apply: { kind: "attribute", name: "data-theme" }, role: "colorScheme" } }
    });
    expect(theme).toMatchObject({
      default: "light",
      apply: { kind: "attribute", name: "data-theme" },
      role: "colorScheme"
    });
  });
});
