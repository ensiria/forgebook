In a React Native project (`reactNativeWeb()` in `forgebook.config.ts`), stories are written as React's, their types from
`@forgebook/react-native-web`, and drawn in the browser through react-native-web. A component that calls a native module or a gesture
of native code does not draw in a browser: give it a `.web.tsx` file, or mock what it calls in the preview.

```tsx
import type { Meta, Story } from "@forgebook/react-native-web";

import { Badge } from "./Badge";

export default { title: "Data/Badge", component: Badge } satisfies Meta<typeof Badge>;

/** The label as most pages use it. */
export const Default: Story<typeof Badge> = { args: { label: "New" }, parameters: { main: true } };
```

<!-- more -->

A screen that fills the window (`style={{ flex: 1 }}`) needs `parameters.layout: "fullscreen"`; the app's root providers
(`SafeAreaProvider`, a theme) go in the preview's decorators.

The stories, the configuration and the rest of the adapter: `node_modules/@forgebook/react-native-web/README.md`.
