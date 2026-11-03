/**
 * Tests for the keys the plugin writes for a call's place, as Nuxt's compiler writes them.
 *
 * @module
 */
import MagicString from "magic-string";
import { parseAst } from "vite";
import { describe, expect, it } from "vitest";

import { withPlaceKeys } from "../src/vite/placeKeys.ts";

/**
 * A file's code with the keys of its places.
 *
 * @param code - the code.
 * @param file - the file it is in.
 */
const keyed = (code: string, file = "app/components/A.vue"): string => {
  const source = new MagicString(code);
  withPlaceKeys(source, parseAst(code), file);
  return source.toString();
};

describe("the keys of a call's place", () => {
  it("gives a call without a key one, after its arguments, and leaves a full call alone", () => {
    const written = keyed(
      [
        "const a = useState(() => 0);",
        "const b = useState();",
        'const c = useState("cart", () => 0);',
        "callOnce(load);",
        "useAsyncData(fetchIt, {\n  lazy: true,\n});"
      ].join("\n")
    );
    expect(written).toMatch(/useState\(\(\) => 0, "\$[\w-]{10}"\)/);
    expect(written).toMatch(/useState\("\$[\w-]{10}"\)/);
    expect(written).toContain('useState("cart", () => 0)');
    expect(written).toMatch(/callOnce\(load, "\$[\w-]{10}"\)/);
    expect(written).toMatch(/useAsyncData\(fetchIt, \{\n {2}lazy: true,\n\}, "\$[\w-]{10}"\)/);
  });

  it("writes the same key for the same place, another for another place or file", () => {
    const code = "useState(() => 0);";
    expect(keyed(code)).toBe(keyed(code));
    expect(keyed(code)).not.toBe(keyed(code, "app/components/B.vue"));
    expect(keyed(`${code}\n${code}`).match(/"\$[\w-]{10}"/g)?.length).toBe(2);
    expect(new Set(keyed(`${code}\n${code}`).match(/"\$[\w-]{10}"/g)).size).toBe(2);
  });

  it("leaves a function of the same name imported from elsewhere alone", () => {
    const code = 'import { useState } from "react";\nuseState(0);';
    expect(keyed(code)).toBe(code);
    expect(keyed('import { useState } from "#imports";\nuseState(() => 0);')).toMatch(/"\$[\w-]{10}"\)/);
  });
});
