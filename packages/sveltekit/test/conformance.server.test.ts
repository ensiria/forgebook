/**
 * SvelteKit's renderer passing the adapter suite on a server, in Node. `conformance.test.ts` is the other half.
 *
 * @module
 */
import { describeAdapter } from "@forgebook/testing/conformance";

import { kitSubject } from "./conformanceSubject.ts";

describeAdapter({ ...kitSubject, half: "server" });
