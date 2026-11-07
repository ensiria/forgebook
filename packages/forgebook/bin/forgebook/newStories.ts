/**
 * The first stories of a component, written from its props as the docs extractor reads them (`forgebook new`): the
 * meta, the main story with the required props filled, one story per value of its first choice prop, and the worst
 * case. Args only, so the file is the same for any framework but its type import. Pure: docs in, text out.
 *
 * @module
 */
import type { ComponentDocs, PropDocs } from "../../src/componentDocs.ts";
import { WORST_NUMBER, WORST_TEXT } from "../../src/worstCase.ts";

/** A place the application draws the component, as the file is written from it. */
export type StoryUse = {
  /** The file that draws it, relative to the package: the story's summary names it. */
  readonly file: string;
  /** The props it gives a literal value, as code. */
  readonly args: Readonly<Record<string, string>>;
};

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
  /** Where the application draws it, for realistic values and a story per way it is used; none by default. */
  readonly uses?: readonly StoryUse[];
};

/** How many stories the uses add, the most telling first: past these, a file is long and says little more. */
const MAX_USE_STORIES = 3;

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

/** The value the uses give a prop most often, the first met on a tie; none when no use gives it. */
const mostUsed = (uses: readonly StoryUse[], name: string): string | undefined => {
  const counts = new Map<string, number>();
  for (const use of uses) {
    const value = use.args[name];
    if (value !== undefined) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: string | undefined;
  for (const [value, count] of counts)
    if (best === undefined || count > (counts.get(best) ?? 0)) best = value;
  return best;
};

/**
 * The main story's args, and the props the type checker must point at, as comments: each required prop with the value
 * the application gives it most, else one from its kind; and each other prop at least half the uses give, so the story
 * shows the component as most pages draw it.
 */
const mainArgs = (
  props: readonly PropDocs[],
  uses: readonly StoryUse[]
): { args: [string, string][]; todo: string[] } => {
  const args: [string, string][] = [];
  const todo: string[] = [];
  for (const prop of props) {
    const used = mostUsed(uses, prop.name);
    const given = uses.filter((use) => use.args[prop.name] !== undefined).length;
    if (!prop.isRequired) {
      if (used !== undefined && given * 2 >= uses.length) args.push([prop.name, used]);
      continue;
    }
    const value = used ?? requiredCode(prop);
    if (value === undefined) todo.push(`${prop.name}: ${prop.type}`);
    else args.push([prop.name, value]);
  }
  return { args, todo };
};

/**
 * The args a use gives, only those the component declares, over the main story's required ones: an optional value the
 * main story took from other uses is not this use's.
 */
const useArgs = (
  main: readonly (readonly [string, string])[],
  use: StoryUse,
  declared: ReadonlySet<string>,
  required: ReadonlySet<string>
): (readonly [string, string])[] => {
  const given = Object.entries(use.args).filter(([name]) => declared.has(name));
  return [...main.filter(([name]) => required.has(name) && use.args[name] === undefined), ...given];
};

/** A set of args as one key, whatever their order. */
const argsKey = (args: readonly (readonly [string, string])[]): string =>
  args
    .map(([name, value]) => `${name}=${value}`)
    .sort()
    .join("\n");

/** A use's story name, from the file that draws it (`src/pages/Checkout.tsx` → `InCheckout`), unique in the file. */
const useStoryName = (file: string, taken: Set<string>): string => {
  const base = `In${
    pascal(
      file
        .split("/")
        .pop()
        ?.replace(/\.[^.]+$/, "") ?? ""
    ) || "Use"
  }`;
  let name = base;
  for (let index = 2; taken.has(name); index += 1) name = `${base}${index}`;
  taken.add(name);
  return name;
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
  const uses = input.uses ?? [];
  const { args, todo } = mainArgs(docs.props, uses);
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
  // one story per distinct way the application draws it, the uses that give the most props first
  const declared = new Set(docs.props.map((prop) => prop.name));
  const required = new Set(docs.props.filter((prop) => prop.isRequired).map((prop) => prop.name));
  const seen = new Set([argsKey(args)]);
  const choiceNames = (choice?.choices ?? []).map(
    (value) => `${pascal(choice?.name ?? "")}${pascal(String(value))}`
  );
  const taken = new Set(["Default", "WorstCase", ...choiceNames]);
  const declaredCount = (use: StoryUse): number =>
    Object.keys(use.args).filter((name) => declared.has(name)).length;
  const useStories = [...uses]
    .sort((left, right) => declaredCount(right) - declaredCount(left))
    .flatMap((use) => {
      const storyArgs = useArgs(args, use, declared, required);
      const key = argsKey(storyArgs);
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ use, storyArgs }];
    })
    .slice(0, MAX_USE_STORIES)
    .flatMap(({ use, storyArgs }) =>
      // the path goes in a comment as a quoted string, so a name with `*/` or a line break in it stays text
      story(
        useStoryName(use.file, taken),
        `As ${JSON.stringify(use.file).replaceAll("*/", "*\\/")} draws it.`,
        storyArgs
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
    uses.length === 0
      ? ` * The stories of ${name}, written by \`forgebook new\` from its props: complete them by hand.`
      : ` * The stories of ${name}, written by \`forgebook new\` from its props and from where the application draws it: complete them by hand.`,
    " *",
    " * @module",
    " */",
    `import type { Meta, Story } from ${JSON.stringify(input.typesModule)};`,
    "",
    input.importStatement,
    "",
    `export default { title: ${JSON.stringify(input.title)}, component: ${name} } satisfies Meta<typeof ${name}>;`,
    "",
    ...story("Default", `${name} as most pages use it.`, args, "{ main: true }"),
    ...useStories,
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
