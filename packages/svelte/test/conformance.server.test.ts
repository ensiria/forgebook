/**
 * Svelte passing the adapter suite on a server: the half of the definition of done that renders HTML, run in Node, where
 * the components are compiled for the server. `conformance.test.ts` is the other half.
 *
 * @module
 */
import { describeAdapter } from "@forgebook/testing/conformance";

import { svelteSubject } from "./conformanceSubject.ts";

describeAdapter({ ...svelteSubject, half: "server" });
