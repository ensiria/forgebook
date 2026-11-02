/**
 * `CATALOG.md` from what `forgebook-docs` read: written to be read by an agent before it writes a component, a hook
 * or a helper, so it is dense: one line per entry, no tables, nothing said twice.
 *
 * @remarks
 * Components first (by family and group, from their stories' titles), each with its import, its summary, its props in
 * short (`size=sm|md*|lg`: `*` marks the default; `!` a required prop; events with their parameters) and
 * its parts. Then the docs pages, the other modules, the Sass modules and the style sheets. Pure: data in, text out.
 *
 * @module
 */
import type { FunctionSignatureDocs, PropDocs } from "../../src/componentDocs.ts";
import { pageSlug } from "../../src/docPages.ts";
import { storyId } from "../../src/storyTree.ts";
import type {
  CatalogueComponent,
  CatalogueData,
  CataloguePage,
  ExportDocs,
  ModuleDocs
} from "./catalogueDocs.types.ts";
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
  return `- **${docs.name}**${where}: ${sentence(docs.description)}. ${props}${parts}${story}`;
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

/** One docs page's line, ending with its id when the package's source id is known. */
const pageLine = (page: CataloguePage, sourceId: string | undefined): string => {
  const about = page.description === undefined ? "" : `: ${sentence(page.description)}`;
  const id = sourceId === undefined ? "" : ` · page: \`${sourceId}:${pageSlug(page.title)}\``;
  return `- **${page.title}** \`${page.file}\`${about}${id}`;
};

/** The components' lines, under a heading per family and group. */
const componentSection = (data: CatalogueData): string[] => {
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
  if (section === "components") return componentSection(data);
  if (section === "pages") {
    const pages = data.pages ?? [];
    if (pages.length === 0) return [];
    return ["## Docs", "", ...pages.map((page) => pageLine(page, data.sourceId)), ""];
  }
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
