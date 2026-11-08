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
    expect(coverage).toMatchObject({ storyFiles: 1, withStories: 1 });
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
