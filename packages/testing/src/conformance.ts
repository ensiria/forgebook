/**
 * The contract every framework adapter passes, as tests: what makes an adapter one, so React is not a special case.
 *
 * @remarks
 * An adapter's package calls `describeAdapter` in its own tests with a small subject of its framework: a story that shows
 * a greeting and counts its clicks, and throws for one name. The suite then says what the frame relies on (`renderer.ts`,
 * `adapter.ts`): a story is drawn in its canvas inside its decorators, new args keep its state, it goes away, its errors
 * reach the frame, and it can be drawn on a server, at once or in time. It runs in the adapter's own Vitest, with a simulated page.
 *
 * @module
 */
import { isComponentDocs } from "forgebook/component-docs";
import type { StoryCodeWriter, StoryDrawing, StoryRenderer } from "forgebook/renderer";
import type { LoadedDecorator } from "forgebook/story-module";
import { afterEach, describe, expect, it } from "vitest";

/** The name a subject's story throws for. */
export const THROWING_NAME = "boom";

/** What an adapter hands the suite. */
export type AdapterSubject = {
  /** The framework's name, in the tests' titles. */
  readonly name: string;
  /** Its renderer. */
  readonly renderer: StoryRenderer;
  /**
   * A drawing of a story with a button that shows `Hello <name> <clicks>`, counting its clicks in its own state, and that
   * throws while drawn when the name is `THROWING_NAME`.
   *
   * @param name - the name, as the story's args carry it.
   */
  readonly drawing: (name: string) => StoryDrawing;
  /**
   * A decorator that draws the story inside a `section` with this `data-decorator` value, written as the framework
   * writes one.
   *
   * @param label - the value.
   */
  readonly decorator: (label: string) => LoadedDecorator;
  /** The code writer the shell uses. */
  readonly codeOf: StoryCodeWriter;
  /**
   * The framework's docs of a story file's component, as `extractStoryComponent` reads them. None skips the check, for an
   * adapter with no documented types yet.
   */
  readonly docsOf?: () => unknown;
};

/** The canvases of the running test, emptied after it. */
const canvases: HTMLElement[] = [];

/** A canvas in the page, as the frame gives a story one. */
const canvas = (): HTMLElement => {
  const element = document.createElement("div");
  document.body.append(element);
  canvases.push(element);
  return element;
};

/** Waits until a condition holds, for a framework that draws on its own schedule. */
const settled = async (holds: () => boolean): Promise<void> => {
  await expect.poll(holds, { timeout: 2000 }).toBe(true);
};

/**
 * A server render as a promise: a framework may throw at once or reject, and the frame's tests treat both as a failure.
 *
 * @param renderer - the framework's renderer.
 * @param story - the drawing.
 */
const asyncRender = async (renderer: StoryRenderer, story: StoryDrawing): Promise<string> =>
  renderer.renderToString(story);

/**
 * The suite of an adapter.
 *
 * @param subject - the adapter's subject.
 */
export const describeAdapter = (subject: AdapterSubject): void => {
  const { name, renderer, drawing, decorator, codeOf, docsOf } = subject;

  describe(`the ${name} adapter`, () => {
    afterEach(() => {
      for (const each of canvases.splice(0)) each.remove();
    });

    it("draws a story in its canvas, and says when it is drawn", async () => {
      const element = canvas();
      const story = renderer.mount(element, drawing("Ada"), () => undefined);
      await story.drawn;
      expect(element.textContent).toContain("Hello Ada");
      story.unmount();
    });

    it("draws new args again, keeping the story's own state", async () => {
      const element = canvas();
      const story = renderer.mount(element, drawing("Ada"), () => undefined);
      await story.drawn;
      element.querySelector("button")?.click();
      await settled(() => element.textContent?.includes("1") === true);
      story.update(drawing("Grace"));
      await settled(() => element.textContent?.includes("Hello Grace 1") === true);
      story.unmount();
    });

    it("draws a story inside its decorators, the catalogue's outside the story's", async () => {
      const element = canvas();
      const plain = drawing("Ada");
      const decorated: StoryDrawing = {
        ...plain,
        story: { ...plain.story, decorators: [decorator("story")] },
        decorators: [decorator("catalogue")]
      };
      const story = renderer.mount(element, decorated, () => undefined);
      await story.drawn;
      const inner = element.querySelector('[data-decorator="catalogue"] [data-decorator="story"] button');
      expect(inner?.textContent).toContain("Hello Ada");
      expect(await renderer.renderToString(decorated)).toContain('data-decorator="catalogue"');
      story.unmount();
    });

    it("takes a story away from its canvas", async () => {
      const element = canvas();
      const story = renderer.mount(element, drawing("Ada"), () => undefined);
      await story.drawn;
      story.unmount();
      await settled(() => element.textContent === "");
    });

    it("hands the frame an error thrown while drawing, and draws again when the args change", async () => {
      const errors: Error[] = [];
      const element = canvas();
      const story = renderer.mount(element, drawing(THROWING_NAME), (error) => errors.push(error));
      await settled(() => errors.length > 0);
      story.update(drawing("Ada"));
      await settled(() => element.textContent?.includes("Hello Ada") === true);
      story.unmount();
    });

    it("draws a story as HTML on a server, and fails with what the story throws", async () => {
      expect(await renderer.renderToString(drawing("Ada"))).toContain("Ada");
      await expect(asyncRender(renderer, drawing(THROWING_NAME))).rejects.toThrow();
    });

    it("writes a story's args as the framework's code", () => {
      const code = codeOf("Greeting", { name: "Ada" });
      expect(code).toContain("Greeting");
      expect(code).toContain("Ada");
    });

    it.runIf(docsOf !== undefined)("reads a component's docs in the catalogue's shape", () => {
      expect(isComponentDocs(docsOf?.())).toBe(true);
    });
  });
};
