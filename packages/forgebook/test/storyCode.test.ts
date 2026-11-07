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

/** The written args of a file's stories, by export name. */
const argsOf = (file: string, text: string): unknown => {
  const code = storyCode(file, text);
  return typeof code === "string" ? code : code.args;
};

/** The render texts of a file's stories, by export name. */
const rendersOf = (file: string, text: string): unknown => {
  const code = storyCode(file, text);
  return typeof code === "string" ? code : code.renders;
};

describe("storyCode", () => {
  it("gives each story's render as written, without the file's indentation", () => {
    expect(rendersOf("Button.stories.tsx", FILE)).toEqual({
      Row: "(args) => (\n  <div>\n    <Button {...args} />\n  </div>\n)",
      Grid: "ButtonGrid"
    });
  });

  it("reads a `.js` story file that holds JSX", () => {
    const file = `export default { title: "Inputs/Button" };
export const Row = { render: (args) => <div><Button {...args} /></div> };`;
    expect(rendersOf("Button.stories.js", file)).toEqual({
      Row: "(args) => <div><Button {...args} /></div>"
    });
  });

  it("keeps the hooks and the compound components of a render as written", () => {
    const file = `export default { component: Menu };
export const Open = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    return (
      <Menu open={isOpen} onOpenChange={setIsOpen}>
        <Menu.Item>Copy</Menu.Item>
      </Menu>
    );
  }
};`;
    expect(rendersOf("Menu.stories.tsx", file)).toEqual({
      Open: [
        "() => {",
        "  const [isOpen, setIsOpen] = useState(true);",
        "  return (",
        "    <Menu open={isOpen} onOpenChange={setIsOpen}>",
        "      <Menu.Item>Copy</Menu.Item>",
        "    </Menu>",
        "  );",
        "}"
      ].join("\n")
    });
  });

  it("shows a render kept in a constant or a function of the file as that code, not its name", () => {
    const file = `export default { component: List };
const renderRows = (args) => <List {...args} dense />;
function renderGrid(args) {
  return <Grid {...args} />;
}
export const Rows = { render: renderRows };
export const Cells = { render: renderGrid };`;
    expect(rendersOf("List.stories.tsx", file)).toEqual({
      Rows: "(args) => <List {...args} dense />",
      Cells: "function renderGrid(args) {\n  return <Grid {...args} />;\n}"
    });
  });

  it("takes the meta's render for a story without its own, a story written as a function, and a spread story's", () => {
    const file = `export default { component: Tag, render: (args) => <Tags><Tag {...args} /></Tags> };
export const Plain = { args: { label: "One" } };
export const Own = (args) => <Tag {...args} pill />;
const Template = (args) => <Tag {...args} />;
export const Bound = Template.bind({});
export const Boxed = { render: (args) => <Box><Tag {...args} /></Box> };
export const BoxedAgain = { ...Boxed, args: { label: "Two" } };`;
    expect(rendersOf("Tag.stories.tsx", file)).toEqual({
      Plain: "(args) => <Tags><Tag {...args} /></Tags>",
      Own: "(args) => <Tag {...args} pill />",
      Bound: "(args) => <Tag {...args} />",
      Boxed: "(args) => <Box><Tag {...args} /></Box>",
      BoxedAgain: "(args) => <Box><Tag {...args} /></Box>"
    });
  });

  it("gives each args story's functions, elements and other code as written, the meta's under its own", () => {
    const file = `import { IconStar } from "./icons";
export default { component: Button, args: { size: "md", onClick: () => alert("hi") } };
export const WithIcon = {
  args: {
    label: "Star",
    icon: <IconStar size={16} />,
    tone: TONES.primary,
    onClick: fn()
  }
};`;
    expect(argsOf("Button.stories.tsx", file)).toEqual({
      WithIcon: { onClick: "fn()", icon: "<IconStar size={16} />", tone: "TONES.primary" }
    });
  });

  it("leaves plain literals to the value the frame reports, which is the same, and a story with nothing else out", () => {
    const file = `export default { component: Button };
export const Plain = { args: { label: "Go", count: 3, isOn: true, none: null, gone: undefined } };`;
    expect(argsOf("Button.stories.tsx", file)).toEqual({});
  });

  it("follows spreads of the file's constants and of another story's args", () => {
    const file = `export default { component: Card };
const base = { footer: <Footer />, onClose: close };
export const First = { args: { ...base, title: "One" } };
export const Second = { args: { ...First.args, media: <Image src={photo} /> } };
export const Third = { ...Second, name: "Third" };
export const Fourth = {};
Fourth.args = { ...base, onClose: undefined };`;
    expect(argsOf("Card.stories.tsx", file)).toEqual({
      First: { footer: "<Footer />", onClose: "close" },
      Second: { footer: "<Footer />", onClose: "close", media: "<Image src={photo} />" },
      Third: { footer: "<Footer />", onClose: "close", media: "<Image src={photo} />" },
      Fourth: { footer: "<Footer />" }
    });
  });

  it("writes a constant of the file by its value, and an import by its name", () => {
    const file = `import { IconStar } from "./icons";
export default { component: Picker };
const ITEMS = ["a", "b"];
export const Short = { args: { items: ITEMS, icon: IconStar } };`;
    expect(argsOf("Picker.stories.tsx", file)).toEqual({
      Short: { items: '["a", "b"]', icon: "IconStar" }
    });
  });

  it("forgets what a spread or a value it cannot read may replace, and keeps what comes after it", () => {
    const file = `import { shared } from "./shared";
export default { component: Card, args: { footer: <Footer /> } };
export const Mixed = { args: { header: <Header />, ...shared, onClose: close } };
export const Unread = { args: makeArgs() };`;
    expect(argsOf("Card.stories.tsx", file)).toEqual({
      Mixed: { onClose: "close" }
    });
  });

  it("says why a file cannot be read", () => {
    expect(storyCode("Broken.stories.tsx", "export const = ;")).toMatch(/does not parse/);
  });

  it("reads args that spread their own story's, and stories that spread each other, without running away", () => {
    const file = `export default { component: B };
export const A = { args: { onClick: fn() } };
A.args = { ...A.args, label: "x" };
export const D = { ...E };
export const E = { ...D, args: { icon: <Star /> } };
D.args = { ...E.args };
E.args = { ...D.args };
export const C = { render: () => <B /> };`;
    const code = storyCode("B.stories.tsx", file);
    expect(typeof code === "string" ? code : code.renders).toEqual({ C: "() => <B />" });
    expect(typeof code === "string" ? code : code.args["A"]).toEqual({ onClick: "fn()" });
  });

  it("reads what is assigned to a story after it when another story spreads it", () => {
    const file = `export default { component: B };
export const A = { args: { onClick: fn() } };
A.args = { onClose: close };
A.render = (args) => <Box><B {...args} /></Box>;
export const C = { ...A };`;
    const code = storyCode("B.stories.tsx", file);
    expect(typeof code === "string" ? code : code.renders).toEqual({
      A: "(args) => <Box><B {...args} /></Box>",
      C: "(args) => <Box><B {...args} /></Box>"
    });
  });

  it("writes a method as a function, takes `render: undefined` as none, and leaves a helper's story unknown", () => {
    const file = `export default { component: B, render: (args) => <List><B {...args} /></List> };
export const Method = {
  render(args) {
    return <B {...args} />;
  }
};
export const Handler = { args: { onClick() { save(); } } };
export const Unset = { render: undefined };
export const Made = makeStory({ render: () => <B /> });
export function Declared(args) {
  return <B {...args} />;
}`;
    const code = storyCode("B.stories.tsx", file);
    expect(typeof code === "string" ? code : code.renders).toEqual({
      Method: "function (args) {\n  return <B {...args} />;\n}",
      Handler: "(args) => <List><B {...args} /></List>",
      Unset: "(args) => <List><B {...args} /></List>",
      Declared: "function Declared(args) {\n  return <B {...args} />;\n}"
    });
  });

  it("writes an arg written as a method as a function", () => {
    const file = `export default { component: B };
export const Handler = { args: { onClick() { save(); } } };`;
    expect(argsOf("B.stories.tsx", file)).toEqual({ Handler: { onClick: "function () { save(); }" } });
  });
});
