/**
 * Tests for the reading of a story file's meta: the module its component is imported from.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { componentImport } from "../src/vite/componentImport.ts";

describe("componentImport", () => {
  it("finds the module the meta's component is imported from, named or default, without a program", () => {
    const named = `import { Select, type SelectProps } from "./Select";
      export default { title: "A/B", component: Select } satisfies Meta<typeof Select>;`;
    expect(componentImport("Select.stories.tsx", named)).toBe("./Select");
    const fallback = `import Card from "../card/Card";\nexport default { title: "A/B", component: Card };`;
    expect(componentImport("Card.stories.tsx", fallback)).toBe("../card/Card");
  });

  it("finds it through a meta kept in a constant", () => {
    const text = `import { Tag } from "./Tag";\nconst meta = { component: Tag };\nexport default meta;`;
    expect(componentImport("Tag.stories.tsx", text)).toBe("./Tag");
  });

  it("has none for a meta without a component, or one not imported", () => {
    expect(componentImport("Page.stories.tsx", `export default { title: "A/B" };`)).toBeUndefined();
    expect(
      componentImport(
        "X.stories.tsx",
        `const X = () => null;\nexport default { title: "A/B", component: X };`
      )
    ).toBeUndefined();
  });
});
