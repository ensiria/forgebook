/**
 * `CATALOG.md` from what `forgebook-docs` read: written to be read by an agent before it writes a component, a hook
 * or a helper, so it is dense: one line per entry, no tables, nothing said twice.
 *
 * @remarks
 * Components first (by family and group, from their stories' titles), each with its import, its summary, its props in
 * short (`size=sm|md*|lg`: `*` marks the default; `!` a required prop; events with their parameters) and
 * its parts. Then the other modules, the Sass modules, the style sheets and the design tokens, by type, each with its
 * value and its value in each theme. Pure: data in, text out.
 *
 * @module
 */
import type { FunctionSignatureDocs, PropDocs } from "../../src/componentDocs.ts";
import { storyId } from "../../src/storyTree.ts";
import type { DesignToken } from "../../src/vite/designTokens.ts";
import type { CatalogueComponent, CatalogueData, ExportDocs, ModuleDocs } from "./catalogueDocs.types.ts";
import type { CatalogueSection } from "./catalogueOptions.ts";

/** The props whose keys are the parts. */
const PART_MAPS = ["classNames", "styles", "refs"];

/** A prop in short. */
const shortProp = (prop: PropDocs): string => {
  const required = prop.isRequired ? "!" : "";
  switch (prop.kind) {
    case "choice":
      return `${prop.name}${required}=${(prop.choices ?? [])
        .map((choice) =>
          prop.defaultValue === JSON.stringify(choice) || prop.defaultValue === String(choice)
            ? `${choice}*`
            : String(choice)
        )
        .join("|")}`;
    case "event":
      return `${prop.name}(${(prop.signature?.parameters ?? []).map((parameter) => parameter.name).join(", ")})`;
    case "toggle":
      return `${prop.name}${required}`;
    default:
      return `${prop.name}${required}:${prop.type}`;
  }
};

/** A sentence without its final full stop, so a line can go on after it. */
const sentence = (text: string): string => text.replace(/\.$/, "");

/** The import of a subpath. */
const importOf = (packageName: string, subpath: string): string => `${packageName}${subpath.slice(1)}`;

/**
 * A hook's or a function's call, short: its type parameters, its parameters' names (`?` when optional, `...` for the
 * rest) and its return type.
 *
 * @param name - its name.
 * @param signature - its signature.
 */
const shortCall = (name: string, signature: FunctionSignatureDocs): string => {
  const types = signature.typeParameters.length === 0 ? "" : `<${signature.typeParameters.join(", ")}>`;
  const parameters = signature.parameters
    .map((parameter) => `${parameter.isRest ? "..." : ""}${parameter.name}${parameter.isOptional ? "?" : ""}`)
    .join(", ");
  return `${name}${types}(${parameters}): ${signature.returns}`;
};

/** One component's line, ending with its main story's id when the package's source id is known. */
const componentLine = (
  packageName: string,
  component: CatalogueComponent,
  sourceId: string | undefined
): string => {
  const { docs } = component;
  const where = ` \`${importOf(packageName, component.subpath)}\``;
  // the part maps are summed up by the parts at the end of the line; a hook is listed by its call, not by props
  const props =
    component.isLogic && docs.signature !== undefined
      ? shortCall(docs.name, docs.signature)
      : docs.props
          .filter((prop) => !PART_MAPS.includes(prop.name))
          .map(shortProp)
          .join(" ");
  const parts = docs.parts.length === 0 ? "" : ` · parts: ${docs.parts.join(", ")}`;
  const story =
    sourceId === undefined || component.mainStory === undefined
      ? ""
      : ` · story: \`${storyId(sourceId, component.title, component.mainStory)}\``;
  const design = component.design === undefined ? "" : ` · design: ${component.design}`;
  return `- **${docs.name}**${where}: ${sentence(docs.description)}. ${props}${parts}${story}${design}`;
};

/** Letters and digits only, lower case: how a subpath and an export name are compared. */
const comparable = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The module's main export: the one named after the subpath (`./theming/tokens-css` → `tokensCss`), then one whose
 * name holds it (`./theming/contrast` → `analyseContrast`), otherwise the first function or value.
 */
const mainExport = (subpath: string, entries: readonly ExportDocs[]): ExportDocs | undefined => {
  const name = comparable(subpath.split("/").at(-1) ?? "");
  return (
    entries.find((entry) => comparable(entry.name) === name) ??
    entries.find((entry) => comparable(entry.name).includes(name)) ??
    entries[0]
  );
};

/** One module's line. */
const moduleLine = (packageName: string, module: ModuleDocs): string => {
  const values = module.exports.filter((entry) => entry.kind !== "type");
  const types = module.exports.filter((entry) => entry.kind === "type").map((entry) => entry.name);
  const main = mainExport(module.subpath, values);
  const head = main === undefined ? "" : ` ${shortExport(main)}: ${sentence(main.summary)}`;
  const rest = [
    ...values.filter((entry) => entry !== main).map(shortExport),
    ...(types.length === 0 ? [] : [`types ${types.join(", ")}`])
  ];
  return `- \`${importOf(packageName, module.subpath)}\`${head}${rest.length === 0 ? "" : `. Also: ${rest.join(", ")}`}`;
};

/** One export in short: a function with its parameters, a value or a type by name. */
const shortExport = (entry: ExportDocs): string =>
  entry.kind === "function" ? `${entry.name}(${(entry.parameters ?? []).join(", ")})` : entry.name;

/** A title's family, group (empty when it has none) and name. */
const place = (title: string): readonly [string, string, string] => {
  const segments = title.split("/");
  return [segments[0] ?? "", segments.length === 3 ? (segments[1] ?? "") : "", segments.at(-1) ?? ""];
};

/**
 * Compares components by where their titles place them: by family, the ones without a group first, then by group
 * and name, so each family and group is one heading.
 */
const byPlace = (left: { readonly title: string }, right: { readonly title: string }): number => {
  const [leftFamily, leftGroup, leftName] = place(left.title);
  const [rightFamily, rightGroup, rightName] = place(right.title);
  return (
    leftFamily.localeCompare(rightFamily) ||
    leftGroup.localeCompare(rightGroup) ||
    leftName.localeCompare(rightName)
  );
};

/** Text on one line, whatever its file wrote, since an entry is one line. */
const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();

/** One token's line: its value, each theme's, what it aliases, what it is for and why not to use it. */
const tokenLine = (token: DesignToken): string => {
  const facts = [
    `\`${oneLine(token.value)}\``,
    ...Object.entries(token.modes).map(([mode, value]) => `${oneLine(mode)} \`${oneLine(value)}\``),
    ...(token.isThemeOnly === true ? ["only in themes"] : []),
    ...(token.alias === undefined ? [] : [`alias of \`${oneLine(token.alias)}\``]),
    ...(token.description === undefined ? [] : [sentence(oneLine(token.description))]),
    ...(token.deprecated === undefined ? [] : [`deprecated: ${sentence(oneLine(token.deprecated))}`])
  ];
  return `- \`${oneLine(token.name)}\`: ${facts.join(" · ")}`;
};

/** The tokens' lines, by type, each type in the order the files first give it; none when the package has none. */
const tokenLines = (tokens: readonly DesignToken[]): string[] => {
  if (tokens.length === 0) return [];
  const types = [...new Set(tokens.map((token) => token.type))];
  return [
    "## Tokens",
    "",
    "Write a token, not its value: each line gives its value, then its value in each theme.",
    "",
    ...types.flatMap((type) => [
      `### ${oneLine(type)}`,
      ...tokens.filter((token) => token.type === type).map(tokenLine)
    ]),
    ""
  ];
};

/** The components' lines, by family and group. */
const componentLines = (data: CatalogueData): string[] => {
  const lines = ["## Components", ""];
  if (data.components.length === 0) return [...lines, "None yet.", ""];
  let heading = "";
  for (const component of [...data.components].sort(byPlace)) {
    const group = component.title.split("/").slice(0, -1).join(" › ");
    if (group !== heading) {
      lines.push(`### ${group}`);
      heading = group;
    }
    lines.push(componentLine(data.packageName, component, data.sourceId));
  }
  return [...lines, ""];
};

/** The lines of one kind of entries, a heading first; none when the package has none of it. */
const sectionLines = (data: CatalogueData, section: CatalogueSection): string[] => {
  if (section === "components") return componentLines(data);
  if (section === "modules") {
    if (data.modules.length === 0) return [];
    const modules = [...data.modules].sort((left, right) => left.subpath.localeCompare(right.subpath));
    return ["## Modules", "", ...modules.map((module) => moduleLine(data.packageName, module)), ""];
  }
  if (section === "sassModules") {
    if (data.sassModules.length === 0) return [];
    return [
      "## Sass modules",
      "",
      `\`@use "pkg:${data.packageName}/scss/<name>"\`.`,
      "",
      ...data.sassModules.map((module) => {
        const members = module.members.map(
          (member) => `${member.name}(${member.parameters.join(", ")}): ${sentence(member.summary)}`
        );
        return `- \`${module.subpath.slice("./scss/".length)}\`: ${members.join("; ")}`;
      }),
      ""
    ];
  }
  if (section === "tokens") return tokenLines(data.tokens);
  if (data.styleSheets.length === 0) return [];
  return [
    "## Style sheets",
    "",
    ...data.styleSheets.map(
      (sheet) => `- \`${importOf(data.packageName, sheet.subpath)}\`: ${sheet.summary}`
    ),
    ""
  ];
};

/**
 * The text of `CATALOG.md`.
 *
 * @param data - what the command read.
 * @param sections - the kinds of entries to list, in this order.
 * @returns the Markdown, ending with a newline.
 */
export const catalogueMarkdown = (data: CatalogueData, sections: readonly CatalogueSection[]): string => {
  const lines = [
    `# ${data.packageName}`,
    "",
    "<!-- GENERATED by forgebook docs from the exports, their TSDoc and the stories: do not edit. -->",
    "",
    "Read before writing a component, hook or helper: what exists, how to import it, its props in short",
    data.sourceId === undefined
      ? "(`a|b*`: values, `*` the default; `!` required; `onX(value)`: an event)."
      : "(`a|b*`: values, `*` the default; `!` required; `onX(value)`: an event), and a story that shows it (`story:`).",
    "",
    ...sections.flatMap((section) => sectionLines(data, section))
  ];
  return `${lines.join("\n").trimEnd()}\n`;
};
