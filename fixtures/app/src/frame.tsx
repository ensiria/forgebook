/**
 * The fixture catalogue's frame page.
 *
 * @module
 */
import { source } from "@fixture/kit/stories";
import { mountFrame } from "@forgebook/react/frame";

import { LANGUAGES } from "./languages";
import { SWITCHES } from "./switches";

const root = document.getElementById("root");
if (root !== null) void mountFrame(root, { sources: [source], languages: LANGUAGES, switches: SWITCHES });
