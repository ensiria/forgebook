# @forgebook/plugin-msw

A story's API answered by [MSW](https://mswjs.io) in [Forgebook](https://www.npmjs.com/package/forgebook), and a **Network** tab
with its handlers and its requests.

**Requirements:** `forgebook` · MSW 2 or 3 · [MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/plugin-msw/LICENSE)

```sh
npm install --save-dev msw @forgebook/plugin-msw
npx msw init public
```

```ts
// forgebook.config.ts
import { msw } from "@forgebook/plugin-msw";

export default defineConfig({ /* … */ plugins: [msw()] });
```

```tsx
export const Loaded: Story<typeof Users> = {
  parameters: {
    msw: { handlers: [http.get("/api/users", () => HttpResponse.json([{ name: "Ada" }]))] }
  }
};
```

MSW loads only for a story with handlers, and a request none of them answers goes to the network. The tab lists the latest 100
requests, by method, address and status, never their bodies, headers or query values. Files the page loads for itself (modules, styles, fonts,
images) go through the same worker and are left out, so a request for a file with such an extension that no handler answers
is not listed.

The tab's id is `msw` (`?tab=msw`, `tabs: { msw: false }`). A catalogue replaces its name (`strings: { "tabs.msw": "API" }`) and its texts by `plugin.msw.<key>`: `none`, `handlers`,
`requests`, `noRequests`, `mocked`, `network`, `method`, `address`, `status`, `answeredBy`.
