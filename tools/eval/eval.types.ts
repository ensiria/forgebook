/**
 * The shapes of the agent evaluation: the apps and tasks it runs on, the agents it starts, what one run measured, and
 * what the judges are handed and give back.
 *
 * @module
 */

/** The two arms: the agent working in a project where `forgebook init --agents` ran, and in the project as it is. */
export type Arm = "with" | "without";

/** A command, as a program and its arguments: never a shell line. `{port}` is replaced by the app's port. */
export type Command = readonly string[];

/** A real open source app at a pinned commit, the ground the tasks are set on. */
export type EvalApp = {
  /** Its name: a plain word, the file's name under `apps/`. */
  readonly name: string;
  /** A public HTTPS repository, without credentials. */
  readonly repository: string;
  /** The commit, in full: a branch or a tag could move between two runs. */
  readonly commit: string;
  /** The framework package Forgebook draws it with (`react`, `nextjs`, `nuxt`…). */
  readonly framework: string;
  /** The package manager its lockfile belongs to. */
  readonly packageManager: "npm" | "pnpm" | "yarn";
  /** Its install, lifecycle scripts off where the manager allows. */
  readonly install: Command;
  /** What else it needs before it runs (a browser for its own tests), in order. */
  readonly prepare: readonly Command[];
  /** Its dev server, listening on `{port}`. */
  readonly dev: Command;
  /**
   * The path its pages are served under (`/dashboard`, as Nuxt's `app.baseURL` or Vite's `base` sets it), which every
   * `goto` and the ready path are read from; empty when it is served at the root.
   */
  readonly basePath: string;
  /** A path, under the base path, that answers only once the dev server can draw a page. */
  readonly readyPath: string;
  /** Its own checks, each run after the change: absent when the app has none of that kind. */
  readonly checks: {
    /** The type check. */
    readonly typecheck?: Command;
    /** The test suite. */
    readonly test?: Command;
    /** The linter. */
    readonly lint?: Command;
  };
};

/** One step in a page, as a person would take it. Roles and names are the accessibility tree's. */
export type Step =
  | { readonly goto: string }
  | { readonly click: Locator }
  | { readonly fill: Locator; readonly value: string }
  | { readonly press: string }
  | { readonly expectVisible: Locator }
  | { readonly expectHidden: Locator }
  | { readonly expectValue: Locator; readonly value: string };

/** The ARIA roles a step may name. */
export type AriaRole =
  | "alert"
  | "alertdialog"
  | "article"
  | "banner"
  | "button"
  | "cell"
  | "checkbox"
  | "columnheader"
  | "combobox"
  | "complementary"
  | "contentinfo"
  | "dialog"
  | "form"
  | "grid"
  | "gridcell"
  | "group"
  | "heading"
  | "img"
  | "link"
  | "list"
  | "listbox"
  | "listitem"
  | "log"
  | "main"
  | "menu"
  | "menuitem"
  | "menuitemcheckbox"
  | "menuitemradio"
  | "meter"
  | "navigation"
  | "note"
  | "option"
  | "paragraph"
  | "progressbar"
  | "radio"
  | "radiogroup"
  | "region"
  | "row"
  | "rowheader"
  | "search"
  | "searchbox"
  | "separator"
  | "slider"
  | "spinbutton"
  | "status"
  | "switch"
  | "tab"
  | "table"
  | "tablist"
  | "tabpanel"
  | "textbox"
  | "timer"
  | "toolbar"
  | "tooltip"
  | "tree"
  | "treeitem";

/** How a step finds an element: by role and accessible name, by label, by placeholder, or by its text. */
export type Locator =
  | { readonly role: AriaRole; readonly name?: string }
  | { readonly label: string }
  | { readonly placeholder: string }
  | { readonly text: string };

/** The window a state is shown in. */
export type Viewport = "desktop" | "narrow";

/** A state of the screen the task touches, pictured for the judges and checked with axe. */
export type PageState = {
  /** Its name: a plain word, the picture's name. */
  readonly name: string;
  /** What it shows, in a line the judges read. */
  readonly description: string;
  /** How to reach it. */
  readonly steps: readonly Step[];
  /** The window: 1280 by 800, or 360 by 780. */
  readonly viewport: Viewport;
  /** The colour scheme the page is asked for. */
  readonly scheme: "light" | "dark";
};

/** A check that the change works, written before any run. */
export type Acceptance = {
  /** What it proves, in a line. */
  readonly name: string;
  /** Its steps, the expectations among them. */
  readonly steps: readonly Step[];
};

/** A constraint the change must keep, written before any run, with how it is judged. */
export type Constraint = {
  /** Its id: `reuse`, `tokens`, `states`, `a11y`, `scope`. */
  readonly id: "reuse" | "tokens" | "states" | "a11y" | "scope";
  /** What it asks, for this task. */
  readonly text: string;
};

/** A task: a UI change a person might ask an agent for, on one app, with its checks written in advance. */
export type EvalTask = {
  /** Its id: a plain word, its folder's name. */
  readonly id: string;
  /** The app's name. */
  readonly app: string;
  /** What the person asks, word for word the agent's prompt in both arms. */
  readonly prompt: string;
  /** The files a change is expected in; a file beyond them counts as outside the task's scope. */
  readonly scope: readonly string[];
  /** The constraints. */
  readonly constraints: readonly Constraint[];
  /** The states pictured and checked. */
  readonly states: readonly PageState[];
  /** The checks that it works. */
  readonly acceptance: readonly Acceptance[];
  /**
   * Stories written in advance for the component the task changes, checked the same way in both arms and never shown
   * to an agent: `source` in the task's folder, `target` where the measurement puts it in the clone.
   */
  readonly probes: readonly { readonly source: string; readonly target: string }[];
};

/** An agent's command line, as the person running the evaluation describes it. */
export type AgentProfile = {
  /** Its name, in the reports. */
  readonly name: string;
  /**
   * The command. Placeholders: `{prompt}` the prompt's text, `{promptFile}` a file holding it, `{workspace}` the
   * project's folder (also the working folder), `{evalDir}` the evaluation's folder, `{arm}`, `{task}` the task's
   * folder; the dry-run stand-in alone may read `{arm}` and `{task}`, a real agent must never be told either.
   */
  readonly command: Command;
  /** The variables of the environment the agent keeps beyond a program's basics: its own login or key, by name. */
  readonly env: readonly string[];
  /** How long a run may take, in minutes, before it is stopped and counted as not done. */
  readonly timeoutMinutes: number;
  /**
   * The hooks `forgebook init --agents` writes in the arm with Forgebook (`--hooks`): this agent's own, so the loop
   * it is sold with is the loop measured. `init`'s choice when absent.
   */
  readonly hooks?: string;
};

/** What the agent said at its end. */
export type Claim = "done" | "not-done" | "none";

/** How a run's claim compares with what the checks found. */
export type Outcome =
  | "done-and-working"
  | "claimed-but-broken"
  | "honest-not-done"
  | "working-unclaimed"
  | "broken-no-claim";

/**
 * One of the app's own checks after the change: passed, failed, failing already on the app as cloned (so it says
 * nothing of the change), or absent from the app.
 */
export type CheckResult =
  | { readonly kind: "passed"; readonly seconds: number }
  | { readonly kind: "failed"; readonly seconds: number; readonly tail: string }
  | { readonly kind: "failing-at-base" }
  | { readonly kind: "absent" };

/** One state's picture and accessibility. */
export type StateMeasure = {
  /** The state's name. */
  readonly name: string;
  /** The picture, from the run's folder; none when the state could not be reached. */
  readonly picture?: string;
  /** Axe's violations, by rule id, with how many nodes each. */
  readonly violations: Readonly<Record<string, number>>;
  /** Why the state could not be reached. */
  readonly error?: string;
};

/** What one run measured. A measure the run could not take says why, never a zero. */
export type RunMeasures = {
  /** The run's id: task, arm and repeat. */
  readonly id: string;
  /** The task. */
  readonly task: string;
  /** The arm. */
  readonly arm: Arm;
  /** The repeat, from 1. */
  readonly repeat: number;
  /** The agent's profile name. */
  readonly agent: string;
  /** The Forgebook build in the arm with it: a release's version, or `sha256:` of the packed tarballs. */
  readonly forgebook: string;
  /** The fingerprint of the task's and its app's definitions when it ran. */
  readonly definition: string;
  /** How long the agent ran, in seconds. */
  readonly agentSeconds: number;
  /** Whether the agent was stopped at its time limit. */
  readonly isTimedOut: boolean;
  /** The agent's exit code. */
  readonly agentExit: number | null;
  /** What it claimed. */
  readonly claim: Claim;
  /** Whether every acceptance check, the type check and the tests passed. */
  readonly isWorking: boolean;
  /** The claim against the checks. */
  readonly outcome: Outcome;
  /** Each acceptance check. */
  readonly acceptance: readonly {
    readonly name: string;
    readonly isPassed: boolean;
    readonly error?: string;
  }[];
  /** The app's own checks. */
  readonly checks: {
    readonly typecheck: CheckResult;
    readonly test: CheckResult;
    readonly lint: CheckResult;
  };
  /** The states. */
  readonly states: readonly StateMeasure[];
  /** `forgebook verify`'s verdict on the change, in every variant, or why it did not run. */
  readonly verify: { readonly verdict: string; readonly summary: string; readonly problems: number } | string;
  /** `forgebook check-code`'s findings on the change, by rule, or why it did not run. */
  readonly checkCode:
    | { readonly problems: number; readonly byRule: Readonly<Record<string, number>> }
    | string;
  /** The stress matrix on the task's probe stories, or why it did not run. */
  readonly stress: { readonly cases: number; readonly broken: number; readonly notVerified: number } | string;
  /** The files the change touched. */
  readonly files: {
    /** Files of the product: what ships. */
    readonly product: readonly string[];
    /** Stories and tests the change wrote or changed. */
    readonly stories: readonly string[];
    /** Files of Forgebook's or an agent's own set-up. */
    readonly tooling: readonly string[];
    /** Product files beyond the task's scope. */
    readonly outsideScope: readonly string[];
    /** Lines added in product files. */
    readonly added: number;
    /** Lines removed in product files. */
    readonly removed: number;
  };
  /** How many words naming the tool were taken out of the judges' diff: above 0, the blinding may be weaker there. */
  readonly redactions: number;
};
