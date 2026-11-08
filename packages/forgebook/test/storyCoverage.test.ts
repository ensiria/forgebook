/**
 * Tests of `storyCoverage`: which components have stories, and which of those the project's code draws.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { projectComponents } from "../src/vite/componentScan.ts";
import type { ProjectFile } from "../src/vite/projectFiles.ts";
import { type StoryCoverage, storyCoverage } from "../src/vite/storyCoverage.ts";

/** A file of a project, its lines joined. */
const file = (path: string, ...lines: string[]): ProjectFile => ({ file: path, text: lines.join("\n") });

/** The coverage of some files, nothing published unless said. */
const coverageOf = (
  files: readonly ProjectFile[],
  isPublished: (path: string) => boolean = () => false
): StoryCoverage => storyCoverage(projectComponents(files), files, isPublished);

/** The names a list holds. */
const names = (list: readonly { readonly name: string }[]): string[] =>
  list.map(({ name }) => name).toSorted();

const BUTTON = file("src/Button.tsx", "export const Button = () => <button type='button' />;");
const CARD = file("src/Card.tsx", "export const Card = () => <div />;");
const BADGE = file("src/Badge.tsx", "export const Badge = () => <span />;");

describe("components without stories", () => {
  it("lists the exported components no story imports", () => {
    const coverage = coverageOf([
      BUTTON,
      BADGE,
      file(
        "src/Button.stories.tsx",
        'import { Button } from "./Button";',
        "export default { component: Button };"
      )
    ]);
    expect(names(coverage.withoutStories)).toEqual(["Badge"]);
    expect(coverage).toMatchObject({ storyFileCount: 1, withStories: 1 });
  });

  it("follows a default import, an alias and a story in a script", () => {
    const coverage = coverageOf([
      file("src/components/Card.tsx", "const Card = () => <div />;", "export default Card;"),
      file("src/ui/Badge.tsx", "export const Badge = () => <span />;"),
      file(
        "src/Card.stories.ts",
        'import Card from "./components/Card";',
        "export default { component: Card };"
      ),
      file(
        "stories/Badge.stories.tsx",
        'import { Badge } from "@/ui/Badge";',
        "export default { component: Badge };"
      )
    ]);
    expect(coverage.withoutStories).toEqual([]);
    expect(coverage.withStories).toBe(2);
  });

  it("takes a name imported through a barrel or a package for every exported component of that name", () => {
    const coverage = coverageOf([
      BUTTON,
      file("src/index.ts", 'export { Button } from "./Button";'),
      file(
        "src/Button.stories.tsx",
        'import { Button } from "@acme/ui";',
        "export default { component: Button };"
      )
    ]);
    expect(coverage.withoutStories).toEqual([]);
  });

  it("leaves out pages, layouts and components a file keeps to itself", () => {
    const coverage = coverageOf([
      file("app/settings/page.tsx", "export default function Page() { return <main />; }"),
      file("src/pages/Home.tsx", "export const Home = () => <main />;"),
      file("src/Panel.tsx", "const Inner = () => <div />;", "export const Panel = () => <Inner />;")
    ]);
    expect(names(coverage.withoutStories)).toEqual(["Panel"]);
  });

  it("reads a story in a single-file component's language", () => {
    const coverage = coverageOf([
      file("src/MyButton.vue", "<template><button /></template>"),
      file(
        "src/MyButton.stories.ts",
        'import MyButton from "./MyButton.vue";',
        "export default { component: MyButton };"
      )
    ]);
    expect(coverage.withoutStories).toEqual([]);
  });
});

describe("stories nobody uses", () => {
  const stories = [
    file(
      "src/Button.stories.tsx",
      'import { Button } from "./Button";',
      "export default { component: Button };"
    ),
    file("src/Card.stories.tsx", 'import { Card } from "./Card";', "export default { component: Card };")
  ];

  it("lists the components with stories that no other file imports or draws, with their story files", () => {
    const coverage = coverageOf([
      BUTTON,
      CARD,
      ...stories,
      file("src/App.tsx", 'import { Button } from "./Button";', "export const App = () => <Button />;")
    ]);
    expect(coverage.storiesUnused).toEqual([
      { name: "Card", file: "src/Card.tsx", line: 1, storyFiles: ["src/Card.stories.tsx"] }
    ]);
  });

  it("counts a tag, a dynamic import and a kebab tag as a use, and not a test or a type", () => {
    const coverage = coverageOf([
      BUTTON,
      CARD,
      BADGE,
      file("src/MyField.vue", "<template><input /></template>"),
      ...stories,
      file("src/Badge.stories.tsx", 'import { Badge } from "./Badge";'),
      file("src/MyField.stories.ts", 'import MyField from "./MyField.vue";'),
      file("src/Shell.tsx", "export const Shell = () => <Card />;"),
      file("src/router.ts", 'export const routes = [{ load: () => import("./Badge") }];'),
      file("src/Form.vue", "<template><my-field /></template>"),
      file("src/Button.test.tsx", 'import { Button } from "./Button";', "render(<Button />);"),
      file("src/types.ts", 'import type { Button } from "./Button";')
    ]);
    expect(names(coverage.storiesUnused)).toEqual(["Button"]);
  });

  it("does not judge a published package's components, which are used outside the repository", () => {
    const coverage = coverageOf([BUTTON, CARD, ...stories], (path) => path === "src/Card.tsx");
    expect(names(coverage.storiesUnused)).toEqual(["Button"]);
    expect(coverage.published).toBe(1);
  });
});

describe("imports written other ways", () => {
  const Ui = file("src/ui/Button.tsx", "export const Button = () => <button type='button' />;");
  const Barrel = file("src/ui/index.ts", 'export * from "./Button";');
  const Story = file("src/ui/Button.stories.tsx", 'import { Button } from "./Button";');

  it("follows a namespace's members through a barrel, in a story and in a use", () => {
    const used = coverageOf([
      Ui,
      Barrel,
      Story,
      file("src/Home.tsx", 'import * as UI from "./ui";', "export const Home = () => <UI.Button />;")
    ]);
    expect(used.storiesUnused).toEqual([]);
    const storied = coverageOf([
      Ui,
      Barrel,
      file(
        "src/ui/Button.stories.tsx",
        'import * as UI from ".";',
        "export default { component: UI.Button };"
      )
    ]);
    expect(storied.withoutStories).toEqual([]);
  });

  it("reads an ES module's .js extension, comments in braces and a require", () => {
    const coverage = coverageOf([
      file("src/ui/Button.tsx", "const Button = () => <button />;", "export default Button;"),
      file("src/ui/Card.tsx", "export const Card = () => <div />;"),
      file("src/ui/Badge.tsx", "export const Badge = () => <span />;"),
      file("src/ui/Button.stories.tsx", 'import Btn from "./Button.js";'),
      file("src/ui/Card.stories.tsx", 'import {\n  Card, // the main one\n} from "./Card";'),
      file("src/ui/Badge.stories.tsx", 'import { Badge } from "./Badge";'),
      file(
        "src/legacy.js",
        'const { Badge: B } = require("./ui/Badge");',
        'const card = require("./ui/Card");'
      )
    ]);
    expect(coverage.withoutStories).toEqual([]);
    expect(names(coverage.storiesUnused)).toEqual(["Button"]);
  });

  it("knows a component exported under another name by the name its file declares", () => {
    const coverage = coverageOf([
      file("src/Dialog.tsx", "const Root = () => <div />;", "export { Root as Dialog };"),
      file("src/Dialog.stories.tsx", 'import { Dialog } from "./Dialog";'),
      file("src/Screen.tsx", 'import { Dialog } from "./Dialog";', "export const Screen = () => <Dialog />;")
    ]);
    expect(coverage.withoutStories.map(({ name }) => name)).toEqual(["Screen"]);
    expect(coverage.storiesUnused).toEqual([]);
  });

  it("takes a folder named tests as the application's own, and only test files as tests", () => {
    const coverage = coverageOf([
      Ui,
      Story,
      file(
        "src/tests/Quiz.tsx",
        'import { Button } from "../ui/Button";',
        "export const Quiz = () => <Button />;"
      )
    ]);
    expect(coverage.storiesUnused).toEqual([]);
  });

  it("finds an alias's file by the end of its path", () => {
    const coverage = coverageOf([
      file("src/a/Item.tsx", "export const Item = () => <li />;"),
      file("src/b/Item.tsx", "export const Item = () => <li />;"),
      file("src/a/Item.stories.tsx", 'import { Item } from "@/a/Item";'),
      file("src/b/Item.stories.tsx", 'import { Item } from "@/b/Item";'),
      file("src/List.tsx", 'import { Item } from "@/a/Item";', "export const List = () => <ul />;")
    ]);
    expect(coverage.storiesUnused.map(({ file: path }) => path)).toEqual(["src/b/Item.tsx"]);
  });

  it("reads crafted files in linear time", () => {
    const crafted = [
      `import${" ".repeat(999_990)}`,
      "import a ".repeat(111_000),
      `${"x".repeat(190)} =require('x')`.repeat(4800),
      `import * as UI from "./ui";\n${"UI.".repeat(330_000)}`
    ];
    const started = performance.now();
    coverageOf(crafted.map((text, index) => file(`src/f${index}.ts`, text)));
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
