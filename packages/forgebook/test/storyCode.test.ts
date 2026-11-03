/**
 * Tests for the Code card's story texts.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { storyCode } from "../src/vite/storyCode.ts";

/** A story file with a story drawn from its args and two with a `render`. */
const FILE = `import { Button } from "./Button";

export default { title: "Actions/Button", component: Button };

export const Danger = { args: { tone: "danger" } };

export const Row = {
  render: (args) => (
    <div>
      <Button {...args} />
    </div>
  )
} satisfies Story<typeof Button>;

export const Grid = { render: ButtonGrid };
`;

describe("storyCode", () => {
  it("gives each story's render as written, without the file's indentation, and leaves out the others", () => {
    expect(storyCode("Button.stories.tsx", FILE)).toEqual({
      Row: "(args) => (\n  <div>\n    <Button {...args} />\n  </div>\n)",
      Grid: "ButtonGrid"
    });
  });

  it("reads a `.js` story file that holds JSX", () => {
    const file = `export default { title: "Inputs/Button" };
export const Row = { render: (args) => <div><Button {...args} /></div> };`;
    expect(storyCode("Button.stories.js", file)).toEqual({
      Row: "(args) => <div><Button {...args} /></div>"
    });
  });

  it("says why a file cannot be read", () => {
    expect(storyCode("Broken.stories.tsx", "export const = ;")).toMatch(/does not parse/);
  });
});
