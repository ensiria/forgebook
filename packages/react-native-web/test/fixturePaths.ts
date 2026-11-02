/**
 * Where the repository's React Native fixture is, for the tests that read its files (never import them).
 *
 * @module
 */
import { join } from "node:path";

/** The React Native fixture: a small app's components with stories, read as a React Native project's catalogue. */
export const NATIVE_FIXTURE_DIR = join(import.meta.dirname, "..", "..", "..", "fixtures", "react-native");
