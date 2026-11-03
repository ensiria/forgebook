/**
 * Tests for where a story file's component comes from, read with Vite's parser from the file alone.
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

  it("reads a meta held in a constant, exported by default or by name, as Storybook's docs read it", () => {
    const constant = `import { Badge } from "./Badge";
      const meta: Meta<typeof Badge> = { title: "A/B", component: Badge };
      export default meta;`;
    expect(componentImport("Badge.stories.tsx", constant)).toBe("./Badge");
    const satisfied = `import { Badge } from "./Badge";
      const meta = { title: "A/B", component: Badge } satisfies Meta<typeof Badge>;
      export { meta as default };`;
    expect(componentImport("Badge.stories.tsx", satisfied)).toBe("./Badge");
  });

  it("reads a `.js` story file with JSX, and a component imported by its default name", () => {
    const js = `import Button from "./Button";
      export default { title: "A/B", component: Button };
      export const Default = { render: () => <Button /> };`;
    expect(componentImport("Button.stories.js", js)).toBe("./Button");
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
