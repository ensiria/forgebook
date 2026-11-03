/**
 * Svelte passing the adapter suite in a simulated page: the half of the definition of done that draws in a canvas, with
 * the code writer and the docs. `conformance.server.test.ts` is the other half.
 *
 * @module
 */
import { describeAdapter } from "@forgebook/testing/conformance";

import { svelteSubject } from "./conformanceSubject.ts";

describeAdapter({ ...svelteSubject, half: "page" });
