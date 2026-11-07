/**
 * The evaluation's definitions read and checked before any work: an app, a task, an agent's profile. Everything here is
 * pure: text in, a definition or the list of what is wrong with it out.
 *
 * @remarks
 * A definition is what makes a run reproducible and fair, so it refuses what would make it drift or leak: a repository
 * not on HTTPS or with credentials in its address, a commit that is not a full hash, a path that climbs out of the
 * clone, and a real agent's command that would tell it which arm it is in.
 *
 * @module
 */
import { isAbsolute, relative, resolve } from "node:path";

import type {
  Acceptance,
  AgentProfile,
  AriaRole,
  Command,
  Constraint,
  EvalApp,
  EvalTask,
  Locator,
  PageState,
  Step
} from "./eval.types.ts";

/** A commit in full. */
const FULL_COMMIT = /^[0-9a-f]{40}$/;

/** A name: a folder's, a file's, a picture's. */
const NAME = /^[a-z0-9][a-z0-9-]*$/;

/** The constraints every task states, in this order. */
export const CONSTRAINT_IDS: readonly Constraint["id"][] = ["reuse", "tokens", "states", "a11y", "scope"];

/** The placeholders only the dry-run stand-in may read: the arm, and the task's folder where its script is. */
const STAND_IN_PLACEHOLDERS = ["{arm}", "{task}"];

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is a non-empty text. */
const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

/** Whether a value is a command: a list of texts, none empty. */
const isCommand = (value: unknown): value is Command =>
  Array.isArray(value) && value.length > 0 && value.every(isText);

/** Whether a path stays inside the folder it is named from. */
export const isInside = (path: string): boolean => {
  if (isAbsolute(path)) return false;
  const inside = relative("/root", resolve("/root", path));
  return inside !== "" && !inside.startsWith("..") && !isAbsolute(inside);
};

/** Whether an address is a public HTTPS repository with no credentials in it. */
const isPublicHttps = (address: unknown): boolean => {
  if (typeof address !== "string" || !URL.canParse(address)) return false;
  const url = new URL(address);
  return url.protocol === "https:" && url.username === "" && url.password === "";
};

/** A list of texts, or nothing when the value is not one. */
const texts = (value: unknown): readonly string[] | undefined =>
  Array.isArray(value) && value.every(isText) ? value : undefined;

/** The package managers an app may use. */
const PACKAGE_MANAGERS: readonly EvalApp["packageManager"][] = ["npm", "pnpm", "yarn"];

/** The package manager a value names, or nothing when it names none known. */
const packageManagerOf = (value: unknown): EvalApp["packageManager"] | undefined =>
  PACKAGE_MANAGERS.find((manager) => manager === value);

/** Each field of an app's definition with its rule, and what to say when it breaks it. */
const APP_RULES: readonly (readonly [string, (value: unknown) => boolean, string])[] = [
  ["repository", isPublicHttps, "must be a public https address without credentials"],
  ["commit", (value) => typeof value === "string" && FULL_COMMIT.test(value), "must be a full commit hash"],
  ["framework", isText, "is missing"],
  ["packageManager", (value) => packageManagerOf(value) !== undefined, "must be npm, pnpm or yarn"],
  ["install", isCommand, "must be a command"],
  [
    "dev",
    (value) => isCommand(value) && value.includes("{port}"),
    "must be a command that listens on {port}"
  ],
  ["prepare", (value) => Array.isArray(value) && value.every(isCommand), "must be a list of commands"],
  ["readyPath", (value) => typeof value === "string" && value.startsWith("/"), "must start with /"]
];

/** What is wrong with an app's checks. */
const checksProblems = (checks: unknown, name: string): string[] => {
  if (!isRecord(checks)) return [`${name}: "checks" must be an object`];
  return Object.entries(checks).flatMap(([key, command]) => {
    if (!["typecheck", "test", "lint"].includes(key)) return [`${name}: unknown check "${key}"`];
    return isCommand(command) ? [] : [`${name}: check "${key}" must be a command`];
  });
};

/**
 * What is wrong with an app's definition; empty when nothing is.
 *
 * @param value - the definition, parsed.
 * @param name - the file's name, without `.json`.
 */
export const appProblems = (value: unknown, name: string): string[] => {
  if (!isRecord(value)) return [`${name}: not an object`];
  return [
    ...(value["name"] === name ? [] : [`${name}: "name" must be the file's name, ${name}`]),
    ...APP_RULES.flatMap(([field, isValid, message]) =>
      isValid(value[field]) ? [] : [`${name}: "${field}" ${message}`]
    ),
    ...checksProblems(value["checks"], name)
  ];
};

/**
 * Reads an app's definition.
 *
 * @param text - the file's text.
 * @param name - the file's name, without `.json`.
 * @throws when it is not valid, naming every problem.
 */
export const parseApp = (text: string, name: string): EvalApp => {
  const value: unknown = JSON.parse(text);
  const problems = appProblems(value, name);
  if (problems.length > 0 || !isRecord(value)) throw new Error(problems.join("\n"));
  const checks = isRecord(value["checks"]) ? value["checks"] : {};
  const command = (key: string): Command | undefined => {
    const each = checks[key];
    return isCommand(each) ? each : undefined;
  };
  const typecheck = command("typecheck");
  const test = command("test");
  const lint = command("lint");
  return {
    name,
    repository: String(value["repository"]),
    commit: String(value["commit"]),
    framework: String(value["framework"]),
    packageManager: packageManagerOf(value["packageManager"]) ?? "pnpm",
    install: isCommand(value["install"]) ? value["install"] : [],
    prepare: Array.isArray(value["prepare"]) ? value["prepare"].filter(isCommand) : [],
    dev: isCommand(value["dev"]) ? value["dev"] : [],
    readyPath: String(value["readyPath"]),
    checks: {
      ...(typecheck === undefined ? {} : { typecheck }),
      ...(test === undefined ? {} : { test }),
      ...(lint === undefined ? {} : { lint })
    }
  };
};

/** The ARIA roles a step may name. */
const ARIA_ROLES: readonly AriaRole[] = [
  "alert",
  "alertdialog",
  "article",
  "banner",
  "button",
  "cell",
  "checkbox",
  "columnheader",
  "combobox",
  "complementary",
  "contentinfo",
  "dialog",
  "form",
  "grid",
  "gridcell",
  "group",
  "heading",
  "img",
  "link",
  "list",
  "listbox",
  "listitem",
  "log",
  "main",
  "menu",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "meter",
  "navigation",
  "note",
  "option",
  "paragraph",
  "progressbar",
  "radio",
  "radiogroup",
  "region",
  "row",
  "rowheader",
  "search",
  "searchbox",
  "separator",
  "slider",
  "spinbutton",
  "status",
  "switch",
  "tab",
  "table",
  "tablist",
  "tabpanel",
  "textbox",
  "timer",
  "toolbar",
  "tooltip",
  "tree",
  "treeitem"
];

/** The role a value names, or nothing when it is not one a step may name. */
const roleOf = (value: unknown): AriaRole | undefined => ARIA_ROLES.find((role) => role === value);

/** A locator, or nothing when the value is not one. */
const locatorOf = (value: unknown): Locator | undefined => {
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value).sort().join(",");
  const role = roleOf(value["role"]);
  if (keys === "role" && role !== undefined) return { role };
  if (keys === "name,role" && role !== undefined && isText(value["name"]))
    return { role, name: value["name"] };
  if (keys === "label" && isText(value["label"])) return { label: value["label"] };
  if (keys === "placeholder" && isText(value["placeholder"])) return { placeholder: value["placeholder"] };
  if (keys === "text" && isText(value["text"])) return { text: value["text"] };
  return undefined;
};

/** The steps that take an element alone, each made from its locator. */
const LOCATOR_STEPS: Readonly<Record<string, (locator: Locator) => Step>> = {
  click: (locator) => ({ click: locator }),
  expectVisible: (locator) => ({ expectVisible: locator }),
  expectHidden: (locator) => ({ expectHidden: locator })
};

/** The steps that take an element and a value, each made from both. */
const VALUE_STEPS: Readonly<Record<string, (locator: Locator, value: string) => Step>> = {
  fill: (locator, value) => ({ fill: locator, value }),
  expectValue: (locator, value) => ({ expectValue: locator, value })
};

/** A step that names an element, or nothing when the value is not one. */
const elementStepOf = (
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[]
): Step | undefined => {
  const [first = "", second] = keys;
  const alone = LOCATOR_STEPS[first];
  if (keys.length === 1 && alone !== undefined) {
    const locator = locatorOf(value[first]);
    return locator === undefined ? undefined : alone(locator);
  }
  const withValue = VALUE_STEPS[first];
  const text = value["value"];
  if (keys.length !== 2 || second !== "value" || withValue === undefined || typeof text !== "string")
    return undefined;
  const locator = locatorOf(value[first]);
  return locator === undefined ? undefined : withValue(locator, text);
};

/**
 * A step, or nothing when the value is not one.
 *
 * @param value - the step, parsed.
 */
export const stepOf = (value: unknown): Step | undefined => {
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value).sort().join(",");
  if (keys === "goto" && typeof value["goto"] === "string" && value["goto"].startsWith("/"))
    return { goto: value["goto"] };
  if (keys === "press" && isText(value["press"])) return { press: value["press"] };
  return elementStepOf(value, Object.keys(value).sort());
};

/** The steps of a list, with a problem for each that does not read. */
const stepsOf = (value: unknown, where: string, problems: string[]): Step[] => {
  if (!Array.isArray(value) || value.length === 0) {
    problems.push(`${where}: "steps" must be a non-empty list`);
    return [];
  }
  return value.flatMap((each, index) => {
    const step = stepOf(each);
    if (step === undefined)
      problems.push(`${where}: step ${index + 1} is not a step: ${JSON.stringify(each)}`);
    return step === undefined ? [] : [step];
  });
};

/** One state, or nothing when its name does not read; a problem for each field that does not. */
const stateOf = (each: unknown, where: string, problems: string[]): PageState | undefined => {
  if (!isRecord(each) || typeof each["name"] !== "string" || !NAME.test(each["name"])) {
    problems.push(`${where}: "name" must be a plain word`);
    return undefined;
  }
  if (!isText(each["description"])) problems.push(`${where}: "description" is missing`);
  const viewport = each["viewport"] === "narrow" ? "narrow" : "desktop";
  if (each["viewport"] !== undefined && each["viewport"] !== viewport)
    problems.push(`${where}: "viewport" must be desktop or narrow`);
  const scheme = each["scheme"] === "dark" ? "dark" : "light";
  if (each["scheme"] !== undefined && each["scheme"] !== scheme)
    problems.push(`${where}: "scheme" must be light or dark`);
  return {
    name: each["name"],
    description: String(each["description"]),
    steps: stepsOf(each["steps"], where, problems),
    viewport,
    scheme
  };
};

/** A task's states, with a problem for each that does not read. */
const statesOf = (value: unknown, id: string, problems: string[]): PageState[] => {
  if (!Array.isArray(value) || value.length === 0) {
    problems.push(`${id}: "states" must be a non-empty list`);
    return [];
  }
  const states = value.flatMap((each, index): PageState[] => {
    const state = stateOf(each, `${id}: state ${index + 1}`, problems);
    return state === undefined ? [] : [state];
  });
  const names = states.map((state) => state.name);
  if (new Set(names).size !== names.length) problems.push(`${id}: two states share a name`);
  return states;
};

/** A task's acceptance checks, with a problem for each that does not read. */
const acceptanceOf = (value: unknown, id: string, problems: string[]): Acceptance[] => {
  if (!Array.isArray(value) || value.length === 0) {
    problems.push(`${id}: "acceptance" must be a non-empty list`);
    return [];
  }
  return value.flatMap((each, index): Acceptance[] => {
    const where = `${id}: acceptance ${index + 1}`;
    if (!isRecord(each) || !isText(each["name"])) {
      problems.push(`${where}: "name" is missing`);
      return [];
    }
    const steps = stepsOf(each["steps"], where, problems);
    if (!steps.some((step) => Object.keys(step).some((key) => key.startsWith("expect"))))
      problems.push(`${where}: no step expects anything`);
    return [{ name: each["name"], steps }];
  });
};

/** A task's constraints, with a problem when one of the five is missing or unknown. */
const constraintsOf = (value: unknown, id: string, problems: string[]): Constraint[] => {
  const list = Array.isArray(value) ? value : [];
  const constraints = list.flatMap((each): Constraint[] => {
    if (!isRecord(each) || !isText(each["text"])) return [];
    const match = CONSTRAINT_IDS.find((known) => known === each["id"]);
    if (match === undefined) {
      problems.push(`${id}: unknown constraint "${String(each["id"])}"`);
      return [];
    }
    return [{ id: match, text: each["text"] }];
  });
  const ids = constraints.map((each) => each.id).join(",");
  if (ids !== CONSTRAINT_IDS.join(","))
    problems.push(`${id}: "constraints" must state ${CONSTRAINT_IDS.join(", ")}, in that order`);
  return constraints;
};

/** Whether a path names a story file inside the folder it is named from. */
const isStoryPath = (value: unknown): value is string =>
  typeof value === "string" && isInside(value) && /\.stories\.[a-z]+$/.test(value);

/** A task's probes, or nothing when one does not read. */
const probesOf = (value: unknown): EvalTask["probes"] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const probes = value.flatMap((each) =>
    isRecord(each) && isStoryPath(each["source"]) && isStoryPath(each["target"])
      ? [{ source: each["source"], target: each["target"] }]
      : []
  );
  return probes.length === value.length ? probes : undefined;
};

/**
 * Reads a task's definition.
 *
 * @param text - the file's text.
 * @param id - its folder's name.
 * @param apps - the names of the apps defined.
 * @throws when it is not valid, naming every problem.
 */
export const parseTask = (text: string, id: string, apps: readonly string[]): EvalTask => {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value)) throw new Error(`${id}: not an object`);
  const problems: string[] = [];
  if (value["id"] !== id) problems.push(`${id}: "id" must be the folder's name, ${id}`);
  if (typeof value["app"] !== "string" || !apps.includes(value["app"]))
    problems.push(`${id}: "app" must name one of ${apps.join(", ")}`);
  if (!isText(value["prompt"])) problems.push(`${id}: "prompt" is missing`);
  const scope = texts(value["scope"]) ?? [];
  if (scope.length === 0 || !scope.every(isInside))
    problems.push(`${id}: "scope" must list files inside the clone`);
  const probes = probesOf(value["probes"] ?? []);
  if (probes === undefined)
    problems.push(`${id}: "probes" must list { source, target } story files, each inside its folder`);
  const task: EvalTask = {
    id,
    app: String(value["app"]),
    prompt: String(value["prompt"]),
    scope,
    constraints: constraintsOf(value["constraints"], id, problems),
    states: statesOf(value["states"], id, problems),
    acceptance: acceptanceOf(value["acceptance"], id, problems),
    probes: probes ?? []
  };
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return task;
};

/** What is wrong with an agent's command: not a command, or one that reads what only the stand-in may. */
const commandProblems = (command: unknown, isStandIn: boolean): string[] => {
  if (!isCommand(command)) return [`"command" must be a list of texts`];
  const isLeaking = command.some((word) =>
    STAND_IN_PLACEHOLDERS.some((placeholder) => word.includes(placeholder))
  );
  return isStandIn || !isLeaking
    ? []
    : [
        `"command" must not name ${STAND_IN_PLACEHOLDERS.join(" or ")}: a real agent never learns its arm or reads the task's checks`
      ];
};

/**
 * Reads an agent's profile.
 *
 * @param text - the file's text.
 * @param isStandIn - whether it is the dry-run stand-in, the only command allowed to read its arm.
 * @throws when it is not valid.
 */
export const parseProfile = (text: string, isStandIn: boolean): AgentProfile => {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value)) throw new Error("the profile is not an object");
  const problems: string[] = [];
  if (!isText(value["name"])) problems.push(`"name" is missing`);
  problems.push(...commandProblems(value["command"], isStandIn));
  const env = texts(value["env"] ?? []);
  if (env === undefined) problems.push(`"env" must be a list of variable names`);
  const timeout = value["timeoutMinutes"];
  if (typeof timeout !== "number" || timeout <= 0)
    problems.push(`"timeoutMinutes" must be a positive number`);
  const hooks = value["hooks"];
  if (hooks !== undefined && (typeof hooks !== "string" || !/^[a-z-]+(,[a-z-]+)*$/.test(hooks)))
    problems.push(`"hooks" must be init's --hooks list: claude, codex, cursor, gemini, pre-commit, none`);
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return {
    ...(typeof hooks === "string" ? { hooks } : {}),
    name: String(value["name"]),
    command: isCommand(value["command"]) ? value["command"] : [],
    env: env ?? [],
    timeoutMinutes: typeof timeout === "number" ? timeout : 0
  };
};

/**
 * An agent's command with its placeholders filled.
 *
 * @param command - the profile's command.
 * @param values - each placeholder's value, by name without braces.
 * @throws when the command names a placeholder with no value.
 */
export const filledCommand = (
  command: Command,
  values: Readonly<Record<string, string>>
): readonly string[] =>
  command.map((word) =>
    word.replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => {
      const filled = values[key];
      if (filled === undefined) throw new Error(`the command names {${key}}, which has no value`);
      return filled;
    })
  );
