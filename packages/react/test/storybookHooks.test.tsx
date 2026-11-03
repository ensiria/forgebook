/**
 * Tests for Storybook's preview hooks in a React story: a decorator that reads and changes the story's args with
 * `useArgs`, as a story file written for Storybook does, and the module a story file's import of Storybook's preview API
 * reaches.
 *
 * @module
 */

import { heldStoryClock } from "@forgebook/story-format/clock";
import type { ArgsChange, StoryDrawing } from "forgebook/renderer";
import { type LoadedStory, readPreview, readStory } from "forgebook/story-module";
import { type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { reactRenderer } from "../src/reactRenderer.tsx";
import { useArgs, useGlobals, useParameter } from "../src/storybookHooks.ts";
import { previewApiModule, storybookPreviewApi } from "../src/vite/storybookPreviewApi.ts";

/** A story drawing its `kind` and `name` args, with a parameter. */
const STORY: LoadedStory = ((): LoadedStory => {
  const read = readStory(
    {
      default: { title: "Kit/Event" },
      Event: {
        args: { kind: "user", name: "monalisa" },
        parameters: { tone: "quiet" },
        render: (args: { readonly kind?: unknown; readonly name?: unknown }): ReactNode => (
          <p>
            {String(args.kind)} {String(args.name)}
          </p>
        )
      }
    },
    "Event"
  );
  if (typeof read === "string") throw new Error(read);
  return read;
})();

/**
 * A decorator written as Storybook's stories write one: it sets the name for a new kind with `useArgs`, keeps a count
 * with Storybook's `useState`, and reads a parameter and the globals.
 */
const syncName = (Story: () => ReactNode): ReactNode => {
  const [args, updateArgs] = useArgs();
  const [count] = useState(1);
  const [globals] = useGlobals();
  const tone = useParameter("tone", "loud");
  if (args["kind"] === "bot" && args["name"] !== "dependabot") updateArgs({ name: "dependabot" });
  return (
    <section data-count={count} data-lang={globals["lang"]} data-tone={String(tone)}>
      <Story />
    </section>
  );
};

/**
 * The story drawn with these args, the decorator around it, and what changes its args.
 *
 * @param args - the args.
 * @param changeArgs - what the frame would do with a change.
 */
const drawing = (args: Record<string, unknown>, changeArgs: (change: ArgsChange) => void): StoryDrawing => ({
  identity: { id: "kit:kit-event--event", name: "Event", title: "Kit/Event" },
  story: STORY,
  args,
  texts: {},
  clock: heldStoryClock(0),
  decorators: readPreview({ decorators: [syncName] }).decorators,
  globals: { lang: "it" },
  loaded: {},
  changeArgs
});

describe("Storybook's preview hooks in a React story", () => {
  it("give a decorator the story's args, parameters and globals, and change the args as the panel would", async () => {
    const canvas = document.createElement("div");
    document.body.append(canvas);
    const changes: ArgsChange[] = [];
    const mounted = reactRenderer.mount(
      canvas,
      drawing({ kind: "bot", name: "monalisa" }, (change: ArgsChange): void => {
        changes.push(change);
      }),
      (error: Error) => {
        throw error;
      }
    );
    await mounted.drawn;
    expect(canvas.querySelector("section")?.dataset).toMatchObject({ count: "1", lang: "it", tone: "quiet" });
    expect(changes).toEqual([{ reset: [], set: { name: "dependabot" } }]);
    mounted.update(drawing({ kind: "bot", name: "dependabot" }, () => undefined));
    await vi.waitFor(() => expect(canvas.textContent).toBe("bot dependabot"));
    mounted.unmount();
  });

  it("render on the server, where a change of the args changes nothing", async () => {
    const { changeArgs: _none, ...alone } = drawing({ kind: "bot", name: "monalisa" }, () => undefined);
    const html = await reactRenderer.renderToString(alone);
    expect(html).toContain('data-tone="quiet"');
    expect(html).toContain("monalisa");
  });

  it("throw outside a decorator or a render, as Storybook's do", () => {
    expect(() => useArgs()).toThrow("Storybook preview hooks can only be called inside decorators");
  });
});

/** The module a story file's import of Storybook's preview API resolves to, in a project that installs Storybook. */
const MODULE_ID =
  "\0forgebook-react:storybook-preview-api:with:storybook/preview-api:/kit/src/Event.stories.tsx";

describe("storybookPreviewApi", () => {
  it("answers an import of Storybook's preview API with Forgebook's hooks beside the rest of Storybook's", () => {
    const withPackage = previewApiModule(MODULE_ID);
    expect(withPackage).toContain('export * from "storybook/preview-api";');
    expect(withPackage).toContain(
      'export { useArgs, useGlobals, useParameter, useStoryContext, useChannel } from "@forgebook/react/storybook-hooks";'
    );
    expect(withPackage).toContain(
      'export { useState, useEffect, useMemo, useCallback, useRef, useReducer } from "react";'
    );
    const alone = previewApiModule(
      "\0forgebook-react:storybook-preview-api:alone:@storybook/preview-api:/kit/src/Event.stories.tsx"
    );
    expect(alone).not.toContain("export *");
    expect(previewApiModule("/kit/src/Event.stories.tsx")).toBeUndefined();
  });

  it("leads a story file's import there, and the module's own import to Storybook's, found from the story file", async () => {
    const plugin = storybookPreviewApi();
    const hook = plugin.resolveId;
    if (typeof hook !== "function") throw new Error("The plugin resolves no id");
    const asked: string[] = [];
    const context = {
      resolve: async (source: string, importer: string): Promise<{ readonly id: string }> => {
        asked.push(`${source} from ${importer}`);
        return { id: "/sb/preview-api.js" };
      }
    };
    const resolve = (source: string, importer: string, scan: boolean): unknown =>
      Reflect.apply(hook, context, [source, importer, { isEntry: false, attributes: {}, scan }]);
    expect(await resolve("storybook/preview-api", "/kit/src/Event.stories.tsx", false)).toBe(MODULE_ID);
    expect(await resolve("storybook/preview-api", "/kit/src/Event.stories.tsx", true)).toBeNull();
    expect(await resolve("storybook/preview-api", MODULE_ID, false)).toBe("/sb/preview-api.js");
    expect(asked.at(-1)).toBe("storybook/preview-api from /kit/src/Event.stories.tsx");
    expect(await resolve("storybook/test", "/kit/src/Event.stories.tsx", false)).toBeNull();
  });
});
