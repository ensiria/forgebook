/**
 * Which of a project's components look like the same one.
 *
 * @remarks
 * Pure. A name alone says little (every feature has a `Header`), so it takes a second sign (a telling root, shared props,
 * the same classes) to call two alike; and a component that renders the other is built on it, which is what reuse looks
 * like.
 *
 * @module
 */
import type { ScannedComponent } from "./componentScan.ts";

/** Two or more components that look like one. */
export type LookAlike = {
  /** How sure this is: `high` has two signs beyond the name, or a name and a look. */
  readonly confidence: "high" | "medium";
  /** What they have in common. */
  readonly why: string;
  /** The components. */
  readonly members: readonly Pick<ScannedComponent, "name" | "file" | "line">[];
};

/** Words around a name that say which of a kind it is, and not what kind. */
const VARIANT_WORD =
  /^(?:Primary|Secondary|Tertiary|Base|Custom|Styled|My|App|New|Old|Legacy|Simple|Default|Main|Ui|UI|Shared|Common|Core|Basic|Generic|Global|Small|Large|Big|V\d+)$/;

/** Names of one thing, in the words code uses. */
const SAME_THING: Readonly<Record<string, string>> = {
  Btn: "Button",
  Modal: "Dialog",
  Popup: "Dialog",
  Spinner: "Loader",
  Pill: "Badge",
  Chip: "Badge",
  Textbox: "Input",
  TextField: "Input",
  TextInput: "Input",
  Dropdown: "Select",
  Snackbar: "Toast"
};

/** Names so general, or given by a framework's convention, that two of them have nothing to do with each other. */
const GENERAL_NAME =
  /^(?:App|Page|Layout|Root|Loading|Error|NotFound|Template|Default|Index|Home|Main|Provider|Providers|Wrapper|Container|Content|Header|Footer|Item|Row|Icon|Form|Title|Label|Link|Section|Component|Body|View|Screen|List|Logo)$/;

/** A file that is a route or an entry, whose component is the screen and not something to share. */
const ROUTE_FILE =
  /(?:^|\/)(?:page|layout|route|loading|error|not-found|template|default|_app|_document|\+page|\+layout|\+error)\.[^/]+$|(?:^|\/)(?:routes|pages|screens|views)\//;

/** A name that says it is a screen or a framework's hook into one. */
const SCREEN_NAME = /(?:Page|Layout|Screen|View|Boundary|Fallback|Route)$/;

/** What every component may render at its root, which says nothing of what it is; a project's component is reuse. */
const TELLING_ROOT =
  /^(?:button|a|input|select|textarea|label|dialog|table|nav|form|img|ul|ol|progress|meter)$/;

/** The roots whose look alone tells two components are one: what a person presses or fills in. */
const CONTROL_ROOT = /^(?:button|a|input|select|textarea|label)$/;

/** Props every component takes, which say nothing of what it is. */
const UNTELLING_PROPS = new Set([
  "children",
  "className",
  "class",
  "style",
  "id",
  "ref",
  "key",
  "props",
  "slot"
]);

/** The sign of two components with one look. */
const SAME_CLASSES = "nearly the same classes";

/** How much two lists of classes share, to read as one look. */
const SAME_LOOK = 0.7;

/** Fewer classes than this say nothing of a look. */
const FEWEST_CLASSES = 4;

/** How many controls are compared by look, each with each: more are left out rather than let a report take minutes. */
const MOST_COMPARED = 2000;

/** How many components of one name are compared: past this they are a convention, not copies. */
const MOST_OF_A_NAME = 60;

/** Fewer shared props than this are a coincidence. */
const FEWEST_PROPS = 2;

/**
 * What a component's name says it is, without the words for which of a kind it is.
 *
 * @param name - its name.
 */
export const stemOf = (name: string): string => {
  const words = name.match(/[A-Z]+(?![a-z])|[A-Z][a-z0-9]*|[a-z0-9]+/g) ?? [name];
  const told = words.filter(
    (word, index) => !(VARIANT_WORD.test(word) && words.length > 1 && index < words.length)
  );
  const kept = told.length === 0 ? words : told;
  const whole = kept.join("");
  const last = kept.at(-1) ?? "";
  return SAME_THING[whole] ?? [...kept.slice(0, -1), SAME_THING[last] ?? last].join("");
};

/** How much two lists have in common, from 0 to 1. */
const overlap = (first: readonly string[], second: readonly string[]): number => {
  const [a, b] = [new Set(first), new Set(second)];
  const shared = [...a].filter((each) => b.has(each)).length;
  return a.size + b.size === 0 ? 0 : shared / (a.size + b.size - shared);
};

/** What two components have in common, each a sign they are one. */
const signsBetween = (first: ScannedComponent, second: ScannedComponent): string[] => {
  const shared = first.props.filter((prop) => !UNTELLING_PROPS.has(prop) && second.props.includes(prop));
  const hasSameLook =
    first.classes.length >= FEWEST_CLASSES &&
    second.classes.length >= FEWEST_CLASSES &&
    overlap(first.classes, second.classes) >= SAME_LOOK;
  return [
    ...(first.root !== undefined && first.root === second.root && TELLING_ROOT.test(first.root)
      ? [`both render ${first.root}`]
      : []),
    ...(shared.length >= FEWEST_PROPS ? [`both take ${shared.slice(0, 4).join(", ")}`] : []),
    ...(hasSameLook ? [SAME_CLASSES] : [])
  ];
};

/** Whether one is built on the other: reuse, not a copy. */
const isBuiltOn = (first: ScannedComponent, second: ScannedComponent): boolean =>
  first.renders.includes(second.name) || second.renders.includes(first.name);

/** Joins pairs that share a component into groups. */
const joined = (pairs: readonly (readonly [ScannedComponent, ScannedComponent])[]): ScannedComponent[][] => {
  const parents = new Map<ScannedComponent, ScannedComponent>();
  const rootOfGroup = (each: ScannedComponent): ScannedComponent => {
    let root = each;
    for (let parent = parents.get(root); parent !== undefined; parent = parents.get(root)) root = parent;
    if (root !== each) parents.set(each, root);
    return root;
  };
  const members = new Set(pairs.flat());
  for (const [first, second] of pairs) {
    const [one, two] = [rootOfGroup(first), rootOfGroup(second)];
    if (one !== two) parents.set(one, two);
  }
  const groups = new Map<ScannedComponent, ScannedComponent[]>();
  for (const each of members) {
    const root = rootOfGroup(each);
    groups.set(root, [...(groups.get(root) ?? []), each]);
  }
  return [...groups.values()];
};

/** The groups of one name whose members have signs of being one, any member against any other. */
const groupsOfName = (stem: string, members: readonly ScannedComponent[]): LookAlike[] => {
  const pairs = members.slice(0, MOST_OF_A_NAME).flatMap((first, index) =>
    members.slice(index + 1, MOST_OF_A_NAME).flatMap((second): [ScannedComponent, ScannedComponent][] => {
      if (first.file === second.file || isBuiltOn(first, second)) return [];
      const signs = signsBetween(first, second);
      // a general name with one thing in common is two things that happen to share a word
      return signs.length >= (GENERAL_NAME.test(stem) ? 2 : 1) ? [[first, second]] : [];
    })
  );
  return joined(pairs).map((group) => {
    const signs = [
      ...new Set(
        group.flatMap((one, index) => group.slice(index + 1).flatMap((two) => signsBetween(one, two)))
      )
    ];
    return {
      confidence: signs.length >= 2 ? "high" : "medium",
      why: `named alike (${stem}): ${signs.join(", ")}`,
      members: group.map(({ name, file, line }) => ({ name, file, line }))
    };
  });
};

/** Controls that look alike whatever they are called: the same element, with nearly the same classes and the same props. */
const groupsByLook = (components: readonly ScannedComponent[]): LookAlike[] => {
  const pairs = components.flatMap((first, index) =>
    components.slice(index + 1).flatMap((second): [ScannedComponent, ScannedComponent][] => {
      if (first.file === second.file || isBuiltOn(first, second)) return [];
      const isSameLook = first.root === second.root && signsBetween(first, second).includes(SAME_CLASSES);
      return isSameLook ? [[first, second]] : [];
    })
  );
  return joined(pairs).map((members) => ({
    confidence: "medium",
    why: `all render ${members[0]?.root ?? "the same"}, with nearly the same classes`,
    members: members.map(({ name, file, line }) => ({ name, file, line }))
  }));
};

/**
 * The components that look like one: first by name, then by look across names. Screens are left out: each is one of a
 * kind, however alike their layouts.
 *
 * @param components - every component of the project.
 */
export const lookAlikes = (components: readonly ScannedComponent[]): LookAlike[] => {
  const shareable = components.filter(({ file, name }) => !ROUTE_FILE.test(file) && !SCREEN_NAME.test(name));
  const byStem = new Map<string, ScannedComponent[]>();
  for (const each of shareable) {
    const stem = stemOf(each.name);
    byStem.set(stem, [...(byStem.get(stem) ?? []), each]);
  }
  const named = [...byStem].flatMap(([stem, members]) => groupsOfName(stem, members));
  const inGroup = new Set(
    named.flatMap(({ members }) => members.map(({ file, name }) => `${file}\0${name}`))
  );
  const looked = shareable
    .filter(
      (each) =>
        CONTROL_ROOT.test(each.root ?? "") &&
        each.classes.length >= FEWEST_CLASSES &&
        !inGroup.has(`${each.file}\0${each.name}`)
    )
    .slice(0, MOST_COMPARED);
  return [...named, ...groupsByLook(looked)].toSorted(
    (first, second) => Number(first.confidence === "medium") - Number(second.confidence === "medium")
  );
};
