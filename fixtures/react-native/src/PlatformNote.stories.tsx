/**
 * The platform note: the web's file drawn, `Platform.OS` reading `web`.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react-native-web";

import { PlatformNote } from "./PlatformNote";

export default { title: "Controls/Platform note", component: PlatformNote } satisfies Meta<
  typeof PlatformNote
>;

/** The note, as the browser draws it. */
export const OnTheWeb: Story<typeof PlatformNote> = {};
