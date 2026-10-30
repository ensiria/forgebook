/**
 * `CATALOG.md` from what `forgebook-docs` read: written to be read by an agent before it writes a component, a hook
 * or a helper, so it is dense: one line per entry, no tables, nothing said twice.
 *
 * @remarks
 * Components first (by family and group, from their stories' titles), each with its import, its summary, its props in
 * short (`size=sm|md*|lg`: `*` marks the default; `!` a required prop; events with their parameters) and
 * its parts. Then the other modules, the Sass modules and the style sheets. Pure: data in, text out.
 *
 * @module
 */
import type { PropDocs } from "../../src/componentDocs.ts";
import type { CatalogueComponent, CatalogueData, ExportDocs, ModuleDocs } from "./catalogueDocs.types.ts";

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

/** One component's line. */
const componentLine = (packageName: string, component: CatalogueComponent): string => {
  const { docs } = component;
  const where = ` \`${importOf(packageName, component.subpath)}\``;
  // the part maps are summed up by the parts at the end of the line
  const props = docs.props
    .filter((prop) => !PART_MAPS.includes(prop.name))
    .map(shortProp)
    .join(" ");
  const parts = docs.parts.length === 0 ? "" : ` · parts: ${docs.parts.join(", ")}`;
  return `- **${docs.name}**${where}: ${sentence(docs.description)}. ${props}${parts}`;
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

/**
 * The text of `CATALOG.md`.
 *
 * @param data - what the command read.
 * @returns the Markdown, ending with a newline.
 */
export const catalogueMarkdown = (data: CatalogueData): string => {
  const lines = [
    `# ${data.packageName}`,
    "",
    "<!-- GENERATED by forgebook-docs from the exports, their TSDoc and the stories: do not edit. -->",
    "",
    "Read before writing a component, hook or helper: what exists, how to import it, its props in short",
    "(`a|b*`: values, `*` the default; `!` required; `onX(value)`: an event).",
    ""
  ];
  lines.push("## Components", "");
  if (data.components.length === 0) lines.push("None yet.", "");
  let heading = "";
  for (const component of [...data.components].sort(byPlace)) {
    const group = component.title.split("/").slice(0, -1).join(" › ");
    if (group !== heading) {
      lines.push(`### ${group}`);
      heading = group;
    }
    lines.push(componentLine(data.packageName, component));
  }
  if (data.components.length > 0) lines.push("");
  if (data.modules.length > 0) {
    lines.push("## Modules", "");
    const modules = [...data.modules].sort((left, right) => left.subpath.localeCompare(right.subpath));
    for (const module of modules) lines.push(moduleLine(data.packageName, module));
    lines.push("");
  }
  if (data.sassModules.length > 0) {
    lines.push("## Sass modules", "", `\`@use "pkg:${data.packageName}/scss/<name>"\`.`, "");
    for (const module of data.sassModules) {
      const members = module.members.map(
        (member) => `${member.name}(${member.parameters.join(", ")}): ${sentence(member.summary)}`
      );
      lines.push(`- \`${module.subpath.slice("./scss/".length)}\`: ${members.join("; ")}`);
    }
    lines.push("");
  }
  if (data.styleSheets.length > 0) {
    lines.push("## Style sheets", "");
    for (const sheet of data.styleSheets)
      lines.push(`- \`${importOf(data.packageName, sheet.subpath)}\`: ${sheet.summary}`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
};
