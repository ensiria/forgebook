/**
 * The fixture catalogue's page: the catalogue over the fixture package, for the catalogue's own browser checks.
 *
 * @module
 */
import { source } from "@fixture/kit/stories";
import { mountShell } from "forgebook/shell";

import { storyJsx } from "../../src/storyJsx";
import { LANGUAGES } from "./languages";
import logoUrl from "./logo.svg?url";

const root = document.getElementById("root");
if (root !== null)
  mountShell(root, {
    title: "Fixture catalogue",
    logo: logoUrl,
    // invented heights, so the tests can see a story's box wait at its measured height
    heights: "story-heights.json",
    sources: [source],
    frameUrl: "frame.html",
    languages: LANGUAGES,
    codeOf: storyJsx
  });
