/**
 * A component's or a story's status (waiting for review, experimental, deprecated): a tag the catalogue declares as a
 * status, read by the agents' answers on Node and by the shell's badges, which load only for a catalogue whose stories
 * have tags.
 *
 * @remarks
 * A status is a tag, so it is written where CSF writes one (the preview, a meta, a story; `!name` takes it away) and
 * filtered by the tag filter; the declaration only says which tags are statuses and how they look. A meta's tags give
 * the component's status, a story's the story's. Three are declared by default, each a catalogue may restyle, rename
 * or turn off with `false`. Pure.
 *
 * @module
 */
import { TOOL_TAGS } from "./storyTagNames.ts";

/** How a status reads at a glance: the colour of its badge, each with its text contrast in both appearances. */
export const STATUS_TONES = ["neutral", "info", "positive", "caution", "critical"] as const;

/** One of the tones. */
export type StatusTone = (typeof STATUS_TONES)[number];

/** A status as a catalogue declares it (`statuses: { review: { label: "In review", tone: "caution" } }`). */
export type StatusSetting = {
  /** Its badge's text; the shell's own word for a default status (`strings` replaces it), else its tag. */
  readonly label?: string;
  /** Its badge's colour; `neutral` for a status of the catalogue's own. */
  readonly tone?: StatusTone;
};

/** The statuses a configuration declares, by tag: `false` turns a default one off. */
export type StatusSettings = Readonly<Record<string, StatusSetting | false>>;

/** A status the catalogue has, its defaults filled in. */
export type CatalogueStatus = {
  /** Its tag (`review`). */
  readonly id: string;
  /** Its badge's text, when the catalogue writes one. */
  readonly label?: string;
  /** Its badge's colour. */
  readonly tone: StatusTone;
};

/** The status whose tag says a component is not to be used any more, as TSDoc's `@deprecated` says it. */
export const DEPRECATED_STATUS = "deprecated";

/** The statuses every catalogue has unless it turns them off, in the order their badges come. */
export const DEFAULT_STATUSES: Readonly<Record<string, StatusSetting>> = {
  review: { tone: "caution" },
  experimental: { tone: "info" },
  [DEPRECATED_STATUS]: { tone: "critical" }
};

/**
 * A catalogue's statuses: the defaults, each with what the configuration writes of it, then the configuration's own,
 * less those it turns off.
 *
 * @param settings - what the configuration declares; none for the defaults.
 */
export const catalogueStatuses = (settings: StatusSettings = {}): readonly CatalogueStatus[] =>
  Object.entries({ ...DEFAULT_STATUSES, ...settings }).flatMap(([id, setting]) => {
    if (setting === false) return [];
    const { label, tone } = { ...DEFAULT_STATUSES[id], ...setting };
    return [{ id, tone: tone ?? "neutral", ...(label === undefined ? {} : { label }) }];
  });

/**
 * Statuses declared in several places (the presets', then the catalogue's) as one declaration: status by status and
 * field by field, so a catalogue renames a preset's status and keeps its tone; none when none declares any.
 *
 * @param all - the declarations, in order.
 */
export const mergedStatuses = (
  all: readonly (StatusSettings | undefined)[]
): { readonly statuses?: StatusSettings } => {
  const statuses: Record<string, StatusSetting | false> = {};
  for (const [id, status] of all.flatMap((each) => Object.entries(each ?? {}))) {
    const before = statuses[id];
    statuses[id] = status === false ? false : { ...(before === false ? {} : before), ...status };
  }
  return Object.keys(statuses).length === 0 ? {} : { statuses };
};

/**
 * The statuses a list of tags holds, in the catalogue's order.
 *
 * @param tags - a meta's or a story's tags.
 * @param statuses - the catalogue's statuses.
 */
export const statusesOf = (
  tags: readonly string[],
  statuses: readonly CatalogueStatus[]
): readonly CatalogueStatus[] => statuses.filter((status) => tags.includes(status.id));

/**
 * Why a status's fields cannot be used, or none: only `label` and `tone`, so a misspelt one is named, not ignored.
 *
 * @param id - its tag.
 * @param setting - what is written for it.
 */
const fieldsProblem = (id: string, setting: object): string | undefined => {
  const unknown = Object.keys(setting).find((key) => key !== "label" && key !== "tone");
  if (unknown !== undefined) return `the status "${id}" has no field "${unknown}": it takes label and tone`;
  const label: unknown = "label" in setting ? setting.label : undefined;
  const tone: unknown = "tone" in setting ? setting.tone : undefined;
  if (label !== undefined && (typeof label !== "string" || label === ""))
    return `the status "${id}" has a label that is no text`;
  if (tone !== undefined && !STATUS_TONES.some((each) => each === tone))
    return `the status "${id}" has the tone ${JSON.stringify(tone)}: write one of ${STATUS_TONES.join(", ")}`;
  return undefined;
};

/**
 * Why one status a configuration declares cannot be used, or none.
 *
 * @param id - its tag.
 * @param setting - what is written for it.
 */
const statusProblem = (id: string, setting: unknown): string | undefined => {
  if (id === "" || id.startsWith("!") || TOOL_TAGS.has(id))
    return `"${id}" cannot be a status: a status is a tag of your own, not empty, no !name and none of ${[...TOOL_TAGS].join(", ")}`;
  if (setting === false) return undefined;
  if (typeof setting !== "object" || setting === null || Array.isArray(setting))
    return `the status "${id}" must be { label, tone } or false`;
  return fieldsProblem(id, setting);
};

/**
 * Why a configuration's statuses cannot be used, or none: they are written by JavaScript too, which no type stops.
 *
 * @param settings - the value written.
 */
export const statusesProblem = (settings: unknown): string | undefined => {
  if (settings === undefined) return undefined;
  if (typeof settings !== "object" || settings === null || Array.isArray(settings))
    return "statuses must be an object of statuses by tag: { review: { label, tone } }";
  return Object.entries(settings)
    .map(([id, setting]) => statusProblem(id, setting))
    .find((problem) => problem !== undefined);
};
