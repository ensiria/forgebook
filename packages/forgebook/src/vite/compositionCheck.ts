/**
 * What a change writes against how a design system says its components fit together: allowed parents, children and
 * siblings, and plain elements a component stands in for.
 *
 * @remarks
 * Pure, from the syntax tree of the changed files, for what the lines a change adds put there. It says only what the file
 * shows: an element at the root of what a component returns, or held in a prop, may be drawn anywhere, so its parent is not
 * known and it is left alone. Only what an author wrote is enforced, so a design system with no rules gets no findings. A
 * `.vue` or `.svelte` template has no tree here, so only scripts with JSX are read, and the answer does not claim more.
 *
 * @module
 */
import { basename, dirname } from "node:path";

import { type ESTree, parseSync } from "vite";

import type { AddedLine, CodeProblem, ExcusedValue } from "./checkCode.ts";
import type { ComponentRules } from "./componentRules.ts";
import type { ScannedComponent } from "./componentScan.ts";
import { type Element, rootsOf } from "./jsxTree.ts";
import type { ProjectFile, WorkspacePackage } from "./projectFiles.ts";
import { isTooDeep, lineStarts } from "./sourceText.ts";

/** One thing composition found. */
type Finding = {
  readonly line: number;
  readonly value: string;
  readonly fix?: string;
  readonly message: string;
};

/** What a walk needs. */
type Walk = {
  /** The rules of a name as the file writes it. */
  readonly rulesOf: (name: string) => ComponentRules | undefined;
  /** The name as the system calls it. */
  readonly real: (name: string) => string;
  /** The component standing in for a plain element, when one does. */
  readonly standIn: ReadonlyMap<string, string>;
  /** Whether a component renders any of some names, through what it renders in turn. */
  readonly rendersAny: (name: string, wanted: readonly string[]) => boolean;
  /** Whether a line is one the change adds. */
  readonly isAdded: (line: number) => boolean;
  /** What was found. */
  readonly found: Finding[];
};

/** What says a composition is meant: its rule and why, in a comment. */
const IGNORE = /(?:\/\/|\/\*|<!--|\{\/\*)\s*forgebook-ignore\s+composition\s*:\s*([^*\n]{3,120})/;

/** A script that can hold JSX. */
const SCRIPT_FILE = /\.[jt]sx$/;

/** What a file imports: each local name, what the module calls it, and from where. */
const localNames = (
  program: ESTree.Program
): ReadonlyMap<string, { readonly name: string; readonly module: string }> =>
  new Map(
    program.body.flatMap((statement) =>
      statement.type !== "ImportDeclaration"
        ? []
        : statement.specifiers.map((each): [string, { name: string; module: string }] => {
            const module = statement.source.value;
            const name =
              each.type === "ImportSpecifier" && "name" in each.imported
                ? String(each.imported.name)
                : each.local.name;
            return [each.local.name, { name, module }];
          })
    )
  );

/** Whether a module is a third party's: what it exports is not the project's component of that name. */
const isThirdParty = (module: string, packages: readonly WorkspacePackage[]): boolean => {
  if (/^(?:\.{1,2}\/|[@~#]\/)/.test(module)) return false;
  return !packages.some(({ name }) => name !== "" && (module === name || module.startsWith(`${name}/`)));
};

/** Whether a name is a component's and not a plain element's. */
const isComponent = (name: string): boolean => /^[A-Z]/.test(name) || /^[a-zA-Z]+\.[A-Z]/.test(name);

/** Whether a name means a listed one: `Select.Root` is a `Select`, and `UI.Select` too. */
const isListedName = (list: readonly string[], name: string): boolean => {
  const parts = name.split(".");
  return list.includes(name) || list.includes(parts[0] ?? "") || list.includes(parts.at(-1) ?? "");
};

/** What an added element breaks of what may stand around it. */
const checkParents = (
  { real, line }: { readonly real: string; readonly line: number },
  ancestors: readonly string[],
  rules: ComponentRules,
  walk: Walk
): void => {
  const { parents } = rules;
  const inComponents = ancestors.filter(isComponent);
  if (parents === undefined || inComponents.length === 0) return;
  // a component above that renders an allowed parent itself passes its children on to it
  if (ancestors.some((each) => isListedName(parents, each) || walk.rendersAny(each, parents))) return;
  walk.found.push({
    line,
    value: real,
    message: `${real} belongs inside ${parents.join(" or ")}, not ${inComponents.at(-1) ?? ""}.`
  });
};

/** What an element's added children break of what may stand inside it. */
const checkChildren = (
  real: string,
  children: readonly Element[],
  rules: ComponentRules,
  walk: Walk
): void => {
  const allowed = rules.children;
  if (allowed === undefined) return;
  for (const child of children) {
    const name = walk.real(child.name);
    const isFine = !isComponent(name) || isListedName(allowed, name) || walk.rendersAny(name, allowed);
    if (!isFine && walk.isAdded(child.line)) {
      walk.found.push({
        line: child.line,
        value: name,
        message: `${real} takes ${allowed.join(" or ")} inside it, not ${name}.`
      });
    }
  }
};

/** What an element and those beside it break of what may stand beside it, where either is added. */
const checkSiblings = (
  element: Element,
  siblings: readonly Element[],
  rules: ComponentRules,
  walk: Walk
): void => {
  const allowed = rules.siblings;
  if (allowed === undefined || element.isAlternative) return;
  const real = walk.real(element.name);
  for (const sibling of siblings) {
    const other = walk.real(sibling.name);
    const isFine =
      sibling.isAlternative || other === real || !isComponent(other) || isListedName(allowed, other);
    if (!isFine && (walk.isAdded(element.line) || walk.isAdded(sibling.line))) {
      walk.found.push({
        line: sibling.line,
        value: real,
        message: `${real} stands beside ${allowed.join(" or ")}, not ${other}.`
      });
    }
  }
};

/** What one element breaks, standing where it stands. */
const checkElement = (
  element: Element,
  { ancestors, siblings }: { readonly ancestors: readonly string[]; readonly siblings: readonly Element[] },
  walk: Walk
): void => {
  const { name, line, children, isOutOfSight: isHidden } = element;
  const isAdded = walk.isAdded(line);
  const standIn = walk.standIn.get(name);
  if (isAdded && standIn !== undefined && !isHidden) {
    walk.found.push({ line, value: name, fix: standIn, message: `A plain <${name}>: use ${standIn}.` });
  }
  const rules = walk.rulesOf(name);
  if (rules === undefined) return;
  const real = walk.real(name);
  if (isAdded) checkParents({ real, line }, ancestors, rules, walk);
  checkChildren(real, children, rules, walk);
  checkSiblings(element, siblings, rules, walk);
};

/** Walks elements with what stands above and beside each. */
const walked = (elements: readonly Element[], ancestors: readonly string[], walk: Walk): void => {
  for (const element of elements) {
    checkElement(element, { ancestors, siblings: elements.filter((each) => each !== element) }, walk);
    walked(element.children, [...ancestors, walk.real(element.name)], walk);
  }
};

/**
 * The rules of each name. A name the project gives twice with different rules could be either, and one component of it
 * with none says the rules may not be meant for this use, so neither counts; copies that agree do.
 */
const rulesByName = (components: readonly ScannedComponent[]): ReadonlyMap<string, ComponentRules> => {
  const named = new Map<string, ScannedComponent[]>();
  for (const each of components) {
    const list = named.get(each.name);
    if (list === undefined) named.set(each.name, [each]);
    else list.push(each);
  }
  return new Map(
    [...named].flatMap(([name, list]): [string, ComponentRules][] => {
      const [first] = list;
      const written = new Set(list.map((each) => JSON.stringify(each.rules ?? null)));
      return written.size === 1 && first?.rules !== undefined ? [[name, first.rules]] : [];
    })
  );
};

/** What each name renders, whichever component of the name: looked up for every element of a change. */
const rendersByName = (components: readonly ScannedComponent[]): ReadonlyMap<string, readonly string[]> => {
  const renders = new Map<string, string[]>();
  for (const { name, renders: own } of components) {
    const list = renders.get(name);
    if (list === undefined) renders.set(name, [...own]);
    else list.push(...own);
  }
  return renders;
};

/**
 * Whether a file is in a component's own library, whose files are what the stand-in is made of: its folder, or the folder
 * above when each component has a folder of its own (`ui/button/Button.tsx`).
 */
const isInLibraryOf = (component: string, file: string): boolean => {
  const folder = dirname(component);
  const isOwnFolder =
    basename(component)
      .replace(/\.[^.]+$/, "")
      .toLowerCase() === basename(folder).toLowerCase();
  return file.startsWith(`${isOwnFolder ? dirname(folder) : folder}/`);
};

/** What the system knows, read once for a change. */
type System = {
  readonly components: readonly ScannedComponent[];
  readonly ruled: ReadonlyMap<string, ComponentRules>;
  readonly renders: ReadonlyMap<string, readonly string[]>;
  readonly packages: readonly WorkspacePackage[];
};

/** The walk for one file, its imports followed. */
const walkOf = (
  {
    file,
    program,
    lines
  }: { readonly file: string; readonly program: ESTree.Program; readonly lines: readonly AddedLine[] },
  { components, ruled, renders, packages }: System
): Walk => {
  const added = new Set(lines.map(({ line }) => line));
  const imported = localNames(program);
  const real = (written: string): string => {
    const [head = "", ...rest] = written.split(".");
    return [imported.get(head)?.name ?? head, ...rest].join(".");
  };
  const rulesOf = (written: string): ComponentRules | undefined => {
    const module = imported.get(written.split(".")[0] ?? "")?.module;
    if (module !== undefined && isThirdParty(module, packages)) return undefined;
    const name = real(written);
    return ruled.get(name) ?? ruled.get(name.split(".").at(-1) ?? "");
  };
  return {
    rulesOf,
    real,
    standIn: new Map(
      components.flatMap((each) =>
        isInLibraryOf(each.file, file) || each.rules?.insteadOf === undefined
          ? []
          : each.rules.insteadOf.map((element): [string, string] => [element, each.name])
      )
    ),
    rendersAny: (name: string, wanted: readonly string[]): boolean =>
      (renders.get(name) ?? []).some(
        (each) => wanted.includes(each) || (renders.get(each) ?? []).some((inner) => wanted.includes(inner))
      ),
    isAdded: (line: number): boolean => added.has(line),
    found: []
  };
};

/** What composition found in one file, with what a comment excuses set apart. */
const inFile = (
  { file, text }: ProjectFile,
  lines: readonly AddedLine[],
  system: System
): { problems: CodeProblem[]; excused: ExcusedValue[] } => {
  if (!SCRIPT_FILE.test(file) || isTooDeep(text)) return { problems: [], excused: [] };
  const { program, errors } = parseSync(file, text);
  if (errors.length > 0) return { problems: [], excused: [] };
  const walk = walkOf({ file, program, lines }, system);
  for (const root of rootsOf(program, lineStarts(text))) walked(root, [], walk);
  const reasons = new Map(
    lines.flatMap(({ line, text: written }): (readonly [number, string])[] => {
      const reason = IGNORE.exec(written)?.[1];
      return reason === undefined
        ? []
        : [
            [line, reason.trim()],
            [line + 1, reason.trim()]
          ];
    })
  );
  return {
    problems: walk.found
      .filter(({ line }) => !reasons.has(line))
      .map(({ line, value, fix, message }) => ({
        rule: "composition",
        file,
        line,
        value,
        ...(fix === undefined ? {} : { fix }),
        message
      })),
    excused: walk.found.flatMap(({ line, value }) => {
      const reason = reasons.get(line);
      return reason === undefined
        ? []
        : [{ file, line, rule: "composition" as const, reason: `${value}: ${reason}` }];
    })
  };
};

/**
 * What a change writes against how the system says its components fit together.
 *
 * @param added - the lines it adds.
 * @param changed - the changed files as they are now.
 * @param components - every component of the project.
 * @param packages - the repository's packages, to tell a third party's component of the same name; none by default.
 */
export const compositionFindings = (
  added: readonly AddedLine[],
  changed: readonly ProjectFile[],
  components: readonly ScannedComponent[],
  packages: readonly WorkspacePackage[] = []
): { readonly problems: readonly CodeProblem[]; readonly excused: readonly ExcusedValue[] } => {
  if (!components.some((each) => each.rules !== undefined)) return { problems: [], excused: [] };
  const system: System = {
    components,
    ruled: rulesByName(components),
    renders: rendersByName(components),
    packages
  };
  const found = changed.map((file) =>
    inFile(
      file,
      added.filter((line) => line.file === file.file),
      system
    )
  );
  return { problems: found.flatMap((each) => each.problems), excused: found.flatMap((each) => each.excused) };
};
