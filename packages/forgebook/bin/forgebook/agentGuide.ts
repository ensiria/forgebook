/**
 * Forgebook's guide for coding agents, a topic at a time: what `forgebook agents` writes into a project is short on
 * purpose, and `forgebook guide` and the `get_guide` tool print the rest when an agent needs it.
 *
 * @remarks
 * Agents do better with text they ask for than with long static instructions, and a long file loses its middle, so
 * every framework's words stay out of a project that does not use that framework. A framework's file holds its
 * essentials up to the `more` marker, and only those reach the written section; the rest is printed on demand.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { GuideDocument, GuideListDocument } from "../../src/vite/agent.types.ts";
import type { McpTool, McpToolResult } from "../../src/vite/mcpProtocol.ts";
import { textOf } from "./mcpToolParts.ts";

/** The frameworks with an adapter, each named as the adapter's package and its `framework.name`. */
export const GUIDE_FRAMEWORKS = [
  "react",
  "preact",
  "solid",
  "vue",
  "nuxt",
  "svelte",
  "sveltekit",
  "angular",
  "nextjs",
  "react-native-web",
  "web-components",
  "html"
] as const;

/**
 * The framework an adapter's project also lists as a dependency of its own: it writes its stories for the adapter, so
 * the base's sample would only contradict it.
 */
const BUILT_ON: Readonly<Partial<Record<(typeof GUIDE_FRAMEWORKS)[number], string>>> = {
  nextjs: "react",
  "react-native-web": "react",
  nuxt: "vue",
  sveltekit: "svelte"
};

/** The topics that hold for every framework, with what each is about. */
export const GUIDE_TOPICS = {
  stories: "Writing a story file: its exports, its parameters, the texts, the TSDoc agents read",
  devices: "Touch, phones and tablets: the Touch switch and the drawn devices",
  "docs-pages": "The docs pages and the written home: front matter, live stories, blocks",
  links: "The links an answer carries for a person, and a page drawn for its audience",
  commands: "Every command an agent uses, and when",
  setup:
    "What a catalogue may change: checks turned off, the frames' origin, edits that do not arrive, inline previews"
} as const;

/** The topic that prints every other one, for an agent that wants the whole guide at once. */
const ALL_TOPIC = "all";

/** The line of a framework's file that ends its essentials. */
const MORE_MARKER = /^<!-- more -->\n+/m;

/** The placeholder of `agents.md` the framework's essentials take. */
const FRAMEWORK_PLACEHOLDER = "{{framework}}";

/**
 * Whether a name is a framework with a guide.
 *
 * @param name - the name.
 */
export const isGuideFramework = (name: string): name is (typeof GUIDE_FRAMEWORKS)[number] =>
  GUIDE_FRAMEWORKS.some((framework) => framework === name);

/**
 * A file of the guide, as written.
 *
 * @param path - the file, from the guide's folder.
 */
const guideFile = (path: string): string =>
  readFileSync(new URL(`./guide/${path}`, import.meta.url), "utf8").trim();

/**
 * The adapters a manifest's dependency fields list; a manifest that cannot be read lists none, since it is the project's
 * own tools that report it.
 *
 * @param text - the manifest's text.
 */
const manifestDependencies = (text: string): ReadonlySet<string> => {
  let manifest: unknown;
  try {
    manifest = JSON.parse(text);
  } catch {
    return new Set();
  }
  if (typeof manifest !== "object" || manifest === null) return new Set();
  const fields = Object.entries(manifest).filter(([field]) =>
    ["dependencies", "devDependencies", "peerDependencies"].includes(field)
  );
  return new Set(
    fields.flatMap(([, value]: [string, unknown]) =>
      typeof value === "object" && value !== null ? Object.keys(value) : []
    )
  );
};

/**
 * The frameworks a project's stories are written for: the adapter its catalogue's configuration imports, or, with no
 * configuration yet, the adapters its manifest lists.
 *
 * @remarks
 * Both are read as text, never run: a command that prints instructions has no reason to execute the project's code,
 * and a configuration that prints, exits or never settles would decide what it answers.
 *
 * @param configFile - the catalogue's configuration file, when there is one.
 * @param dir - where the manifest is read when there is no configuration file; beside the file otherwise.
 * @returns the frameworks with a guide; none when they cannot be told.
 */
export const projectFrameworks = (configFile: string | undefined, dir: string): readonly string[] => {
  const config = configFile !== undefined && existsSync(configFile) ? readFileSync(configFile, "utf8") : "";
  const imported = GUIDE_FRAMEWORKS.filter((framework) => config.includes(`"@forgebook/${framework}/vite"`));
  if (imported.length > 0) return imported;
  const manifest = join(configFile === undefined ? dir : dirname(configFile), "package.json");
  if (!existsSync(manifest)) return [];
  const listed = manifestDependencies(readFileSync(manifest, "utf8"));
  const adapters = GUIDE_FRAMEWORKS.filter((framework) => listed.has(`@forgebook/${framework}`));
  const bases = adapters.flatMap((framework) => BUILT_ON[framework] ?? []);
  return adapters.filter((framework) => !bases.includes(framework));
};

/**
 * What the section says of the project's framework.
 *
 * @param frameworks - the project's frameworks.
 */
const frameworkText = (frameworks: readonly string[]): string => {
  const [only] = frameworks;
  if (only === undefined) {
    return "`npx forgebook guide <framework>` gives your framework's file names, types and a sample; `npx forgebook guide` lists them.";
  }
  if (frameworks.length > 1) {
    const names = frameworks.map((name) => `\`${name}\``).join(", ");
    return `This project lists several frameworks (${names}): \`npx forgebook guide <name>\` gives each one's file names, types and a sample.`;
  }
  const [essentials = ""] = guideFile(`frameworks/${only}.md`).split(MORE_MARKER);
  return `${essentials.trim()}\n\nThe rest of it: \`npx forgebook guide ${only}\`.`;
};

/**
 * The instructions as a project gets them: the short text, with its frameworks' essentials.
 *
 * @param frameworks - the project's frameworks. One gives its essentials; several, or none, say where to find them,
 * so the section stays short whatever the project lists.
 */
export const agentsSection = (frameworks: readonly string[]): string => {
  const text = frameworkText(frameworks);
  return readFileSync(new URL("./agents.md", import.meta.url), "utf8").replace(
    FRAMEWORK_PLACEHOLDER,
    // a function, so a `$` in the text is not read as a replacement pattern
    () => text
  );
};

/**
 * The topics, with the project's frameworks.
 *
 * @param frameworks - the project's frameworks.
 */
export const guideList = (frameworks: readonly string[]): GuideListDocument => ({
  schema: 1,
  topics: [
    ...Object.entries(GUIDE_TOPICS).map(([topic, about]) => ({ topic, about })),
    ...GUIDE_FRAMEWORKS.map((topic) => ({
      topic,
      about: `Stories in ${topic}: files, types, args, a sample`
    })),
    { topic: ALL_TOPIC, about: "Everything above at once: ask for one topic when you can" }
  ],
  frameworks
});

/**
 * One topic's text.
 *
 * @param topic - the topic.
 * @returns the document, or none when there is no such topic.
 */
export const guideTopic = (topic: string): GuideDocument | undefined => {
  const textOfTopic = (name: string): string | undefined => {
    if (isGuideFramework(name)) return guideFile(`frameworks/${name}.md`).replace(MORE_MARKER, "");
    return Object.hasOwn(GUIDE_TOPICS, name) ? guideFile(`${name}.md`) : undefined;
  };
  if (topic === ALL_TOPIC) {
    const text = [...Object.keys(GUIDE_TOPICS), ...GUIDE_FRAMEWORKS]
      .map((name) => `<!-- forgebook guide ${name} -->\n\n${textOfTopic(name) ?? ""}`)
      .join("\n\n");
    return { schema: 1, topic, text };
  }
  const text = textOfTopic(topic);
  return text === undefined ? undefined : { schema: 1, topic, text };
};

/**
 * The tool that prints the guide, as `forgebook guide` does: it asks nothing of the catalogue, so it answers at once.
 *
 * @param frameworks - the catalogue's frameworks.
 */
export const guideTool = (frameworks: readonly string[]): McpTool => ({
  name: "get_guide",
  description:
    "Forgebook's guide, on demand: how to write a story in this framework, touch and devices, docs pages, links, every command. With no topic, the list of topics.",
  inputSchema: {
    type: "object",
    properties: {
      topic: { type: "string", description: "The topic; none for the list." }
    },
    additionalProperties: false
  },
  call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => {
    const topic = textOf(args, "topic");
    if (topic === undefined) return { structured: guideList(frameworks), isError: false };
    const found = guideTopic(topic);
    return found === undefined
      ? { structured: { error: `No topic ${topic}: get_guide with no topic lists them` }, isError: true }
      : { structured: found, isError: false };
  }
});
