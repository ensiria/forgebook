/**
 * The GitHub Actions the workflows Forgebook writes in a project use: `init --agents`' verify workflow and
 * `proof --write-workflow`'s.
 *
 * @remarks
 * Each is pinned to the commit of its newest release, with the release in a comment, as Dependabot reads and moves it: a
 * tag can be moved under a workflow, and an old major runs on a Node that GitHub's runners no longer support. One place, so
 * both workflows move together.
 *
 * @module
 */

/** Checks the repository out. */
export const CHECKOUT = "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1";

/** Installs Node. */
export const SETUP_NODE = "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0";

/** Keeps a run's files as an artefact. */
export const UPLOAD = "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2";

/** Fetches an artefact in another job. */
export const DOWNLOAD = "actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2";

/** Installs pnpm. */
export const SETUP_PNPM = "pnpm/action-setup@73e46992e05b19abd31f2f3c20e0e7370d762115 # v6.1.1";

/** Installs Bun. */
export const SETUP_BUN = "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0";
