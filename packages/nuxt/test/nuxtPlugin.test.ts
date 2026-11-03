/**
 * Tests for what the plugin writes into a component's code: the imports of the components its template names, and
 * that every name it gives a file without an import is one its module exports.
 *
 * @module
 */
import MagicString from "magic-string";
import { describe, expect, it } from "vitest";

import * as data from "../src/app/data.ts";
import * as define from "../src/app/define.ts";
import * as errors from "../src/app/errors.ts";
import * as fetch from "../src/app/fetch.ts";
import * as head from "../src/app/head.ts";
import * as router from "../src/app/router.ts";
import * as state from "../src/app/state.ts";
import type { ProjectComponent } from "../src/vite/componentNames.ts";
import { withComponentImports } from "../src/vite/nuxtPlugin.ts";
import { NUXT_STAND_INS } from "../src/vite/standIns.ts";

/** The project's components the tests name. */
const COMPONENTS = new Map<string, ProjectComponent>([
  ["BaseBadge", { name: "BaseBadge", file: "/p/app/components/base/Badge.vue" }]
]);

describe("a template's components", () => {
  it("imports Nuxt's own, the project's and a lazy one, each once, and leaves the rest to Vue", () => {
    const code = [
      'const a = _resolveComponent("NuxtLink");',
      'const b = _resolveComponent("base-badge");',
      'const c = _resolveComponent("BaseBadge");',
      'const d = _resolveComponent("LazyBaseBadge");',
      'const e = _resolveComponent("RouterView");'
    ].join("\n");
    const written = withComponentImports(new MagicString(code), COMPONENTS)?.toString() ?? "";
    expect(written).toContain(
      'import { NuxtLink as __nuxt_component_0 } from "@forgebook/nuxt/app/components";'
    );
    expect(written).toContain('import __nuxt_component_1 from "/p/app/components/base/Badge.vue";');
    expect(written).toContain(
      'const __nuxt_component_2 = __forgebookDefineAsync(() => import("/p/app/components/base/Badge.vue"));'
    );
    expect(written).toContain("const b = __nuxt_component_1;\nconst c = __nuxt_component_1;");
    expect(written).toContain('const e = _resolveComponent("RouterView");');
  });

  it("changes nothing in code that names no component it knows", () => {
    expect(withComponentImports(new MagicString('_resolveComponent("Other")'), COMPONENTS)).toBeUndefined();
  });
});

describe("the stand-ins", () => {
  it("are each exported by the module the plugin imports them from", () => {
    const modules: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
      "@forgebook/nuxt/app/router": router,
      "@forgebook/nuxt/app/data": data,
      "@forgebook/nuxt/app/fetch": fetch,
      "@forgebook/nuxt/app/state": state,
      "@forgebook/nuxt/app/errors": errors,
      "@forgebook/nuxt/app/head": head,
      "@forgebook/nuxt/app/define": define
    };
    const missing = NUXT_STAND_INS.filter(({ name, from }) => typeof modules[from]?.[name] !== "function");
    expect(missing).toEqual([]);
  });
});
