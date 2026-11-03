/**
 * A story that asks for the fixture's probe plugin, for the shell's tests of the plugin API.
 *
 * @module
 */
import type { ReactNode } from "react";

/** The probed component. */
const Probed = (): ReactNode => <p data-testid="probed">Probed</p>;

export default { title: "Testing/PluginProbe", component: Probed };

/** The probe's tab, switch and decorator act on this story. */
export const Probe = { parameters: { probe: true } };
