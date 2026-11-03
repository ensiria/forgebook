/**
 * SvelteKit's renderer passing the adapter suite in a simulated page. `conformance.server.test.ts` is the other half.
 *
 * @module
 */
import { describeAdapter } from "@forgebook/testing/conformance";

import { kitSubject } from "./conformanceSubject.ts";

describeAdapter({ ...kitSubject, half: "page" });
