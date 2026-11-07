/**
 * The first stories of a component, written from its props as the docs extractor reads them (`forgebook new`): the
 * meta, the main story with the required props filled, one story per value of its first choice prop, and the worst
 * case. Args only, so the file is the same for any framework but its type import. Pure: docs in, text out.
 *
 * @module
 */
import type { ComponentDocs, PropDocs } from "../../src/componentDocs.ts";
import { WORST_NUMBER, WORST_TEXT } from "../../src/worstCase.ts";

/** What the file is written from. */
export type NewStoriesInput = {
  /** The component's docs (its props). */
  readonly docs: ComponentDocs;
  /** The statement that imports the component (`import { Badge } from "./Badge";`). */
  readonly importStatement: string;
  /** The meta's title (`Actions/Badge`). */
  readonly title: string;
  /** The module the story types come from (`@forgebook/react`). */
  readonly typesModule: string;
  /**
   * Components every story is drawn inside, outermost first, each with its import: the providers a first draw said the
   * component needs (`forgebook new --repair`); none by default. Written as JSX, for a JSX framework's story file.
   */
  readonly wrappers?: readonly StoryWrapper[];
};

/** A component a story is drawn inside, and the statement that imports it. */
export type StoryWrapper = {
  /** The component's name in the file (`SidebarProvider`). */
  readonly name: string;
  /** The statement that imports it (`import { SidebarProvider } from "./sidebar";`). */
  readonly importStatement: string;
};

/** The meta's decorators that draw every story inside the wrappers, outermost first; empty with none. */
const decoratorsCode = (wrappers: readonly StoryWrapper[]): string => {
  if (wrappers.length === 0) return "";
  const open = wrappers.map((wrapper) => `<${wrapper.name}>`).join("");
  const close = [...wrappers]
    .reverse()
    .map((wrapper) => `</${wrapper.name}>`)
    .join("");
  return `, decorators: [(Story) => ${open}<Story />${close}]`;
};

/** A prop's name in words, for a text's value (`helperText` → `Helper text`). */
const words = (name: string): string => {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
};

/** A name in PascalCase, letters and digits only (`md` → `Md`, `x-large` → `XLarge`). */
const pascal = (text: string): string =>
  text
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part !== "")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");

/** A default written in TSDoc, as code: a number or a boolean as it is, a quoted string kept, a word quoted. */
const defaultCode = (text: string): string =>
  /^(-?\d+(\.\d+)?|true|false|null|"[^"]*"|'[^']*')$/.test(text)
    ? text.replace(/^'(.*)'$/, '"$1"')
    : JSON.stringify(text);

/** A required prop's value as code, from its kind; none for one the type checker must point at. */
const requiredCode = (prop: PropDocs): string | undefined => {
  if (prop.defaultValue !== undefined) return defaultCode(prop.defaultValue);
  if (prop.kind === "choice" && prop.choices?.[0] !== undefined) return JSON.stringify(prop.choices[0]);
  if (prop.kind === "text") return JSON.stringify(words(prop.name));
  if (prop.kind === "number") return "0";
  if (prop.kind === "toggle") return "false";
  if (prop.kind === "event") return "() => undefined";
  // an empty list is a safe start for any list prop (`readonly string[]`, `Array<Item>`)
  if (/\[\]$|^(readonly\s+)?(Readonly)?Array<.*>$/.test(prop.type.trim())) return "[]";
  return undefined;
};

/** The widest a line of args gets before each arg goes on a line of its own. */
const LINE_WIDTH = 100;

/** One story's args as code: on one line when it fits, one arg per line otherwise. */
const argsCode = (args: readonly (readonly [string, string])[]): string => {
  if (args.length === 0) return "{}";
  // a name that is no identifier (Vue's `#default`) is a quoted key
  const key = (name: string): string => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name));
  const pairs = args.map(([name, value]) => `${key(name)}: ${value}`);
  const line = `{ ${pairs.join(", ")} }`;
  return line.length <= LINE_WIDTH ? line : `{\n${pairs.map((pair) => `    ${pair}`).join(",\n")}\n  }`;
};

/** The required props' args, and the ones the type checker must point at, as comments. */
const requiredArgs = (props: readonly PropDocs[]): { args: [string, string][]; todo: string[] } => {
  const args: [string, string][] = [];
  const todo: string[] = [];
  for (const prop of props.filter((each) => each.isRequired)) {
    const value = requiredCode(prop);
    if (value === undefined) todo.push(`${prop.name}: ${prop.type}`);
    else args.push([prop.name, value]);
  }
  return { args, todo };
};

/**
 * The story file's text.
 *
 * @param input - the component's docs, its import, the title and the story types' module.
 * @returns the file, ending with a newline.
 */
export const newStories = (input: NewStoriesInput): string => {
  const { docs } = input;
  const name = docs.name;
  const type = `Story<typeof ${name}>`;
  const { args, todo } = requiredArgs(docs.props);
  const todoLine = todo.length === 0 ? [] : [`  // TODO: give ${todo.join(", ")}`];
  const story = (
    exportName: string,
    summary: string,
    storyArgs: readonly (readonly [string, string])[],
    parameters?: string
  ): string[] => [
    `/** ${summary} */`,
    `export const ${exportName}: ${type} = {`,
    ...todoLine,
    `  args: ${argsCode(storyArgs)}${parameters === undefined ? "" : ","}`,
    ...(parameters === undefined ? [] : [`  parameters: ${parameters}`]),
    "};",
    ""
  ];
  const choice = docs.props.find((prop) => prop.kind === "choice" && (prop.choices?.length ?? 0) > 1);
  const choiceStories = (choice?.choices ?? []).flatMap((value) =>
    story(
      `${pascal(choice?.name ?? "")}${pascal(String(value))}`,
      `With ${choice?.name} ${JSON.stringify(value)}.`,
      [...args.filter(([prop]) => prop !== choice?.name), [choice?.name ?? "", JSON.stringify(value)]]
    )
  );
  const worst: [string, string][] = docs.props.flatMap((prop): [string, string][] => {
    if (prop.kind === "text" || prop.canTakeText === true) return [[prop.name, JSON.stringify(WORST_TEXT)]];
    if (prop.kind === "number") return [[prop.name, String(WORST_NUMBER)]];
    return [];
  });
  const worstArgs = [...args.filter(([prop]) => !worst.some(([each]) => each === prop)), ...worst];
  const parts = [
    "/**",
    ` * The stories of ${name}, written by \`forgebook new\` from its props: complete them by hand.`,
    " *",
    " * @module",
    " */",
    `import type { Meta, Story } from ${JSON.stringify(input.typesModule)};`,
    "",
    input.importStatement,
    ...(input.wrappers ?? []).map((wrapper) => wrapper.importStatement),
    "",
    `export default { title: ${JSON.stringify(input.title)}, component: ${name}${decoratorsCode(input.wrappers ?? [])} } satisfies Meta<typeof ${name}>;`,
    "",
    ...story("Default", `${name} as most pages use it.`, args, "{ main: true }"),
    ...choiceStories,
    ...story(
      "WorstCase",
      `Long texts and huge numbers, to see where ${name} breaks.`,
      worstArgs,
      '{ group: "worst-case" }'
    )
  ];
  return `${parts.join("\n").trimEnd()}\n`;
};
