/**
 * The fixture catalogue's frame page.
 *
 * @module
 */
import { mountFrame } from "../../../src/frame/mountFrame";
import { source } from "../kit/stories";
import { LANGUAGES } from "./languages";

const root = document.getElementById("root");
if (root !== null) void mountFrame(root, { sources: [source], languages: LANGUAGES });
