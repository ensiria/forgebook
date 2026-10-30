/**
 * Where the repository's fixture packages are, for the tests that read their files (never import them).
 *
 * @module
 */
import { join } from "node:path";

/** The fixture kit: a small React package with stories, docs and styles. */
export const KIT_DIR = join(import.meta.dirname, "..", "..", "..", "fixtures", "kit");
