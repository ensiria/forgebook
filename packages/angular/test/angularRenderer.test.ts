/**
 * What Angular's renderer does beyond the adapter suite: the ways an Angular story writes what it draws (its component
 * from args, a template with props, Storybook's helpers), projected content and outputs from the args, providers at
 * both levels, the story's texts and clock, and what must not start a story over.
 *
 * @module
 */
import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryDrawing } from "forgebook/renderer";
import { readStory } from "forgebook/story-module";
import { afterEach, describe, expect, it, vi } from "vitest";

import { angularRenderer } from "../src/angularRenderer.ts";
import {
  applicationConfig,
  argsToTemplate,
  componentWrapperDecorator,
  moduleMetadata
} from "../src/stories.ts";
import { Card, Frame, Hello, Legacy, OlderModule, WHO } from "./subjects/Card.ts";

/** The canvases of the running test. */
const canvases: HTMLElement[] = [];

/** A canvas in the page. */
const canvas = (): HTMLElement => {
  const element = document.createElement("div");
  document.body.append(element);
  canvases.push(element);
  return element;
};

/** A drawing of a story file's `Plain` story. */
const drawing = (
  story: Readonly<Record<string, unknown>>,
  args: Readonly<Record<string, unknown>> = {},
  meta: Readonly<Record<string, unknown>> = {}
): StoryDrawing => {
  const loaded = readStory({ default: { title: "Kit/Thing", ...meta }, Plain: story }, "Plain");
  if (typeof loaded === "string") throw new Error(loaded);
  return {
    identity: { id: "kit:kit-thing--plain", name: "Plain", title: "Kit/Thing" },
    story: loaded,
    args,
    texts: {},
    clock: heldStoryClock(0),
    decorators: [],
    globals: {},
    loaded: {}
  };
};

/** Waits until a condition holds. */
const settled = async (holds: () => boolean): Promise<void> => {
  await expect.poll(holds, { timeout: 2000 }).toBe(true);
};

afterEach(() => {
  for (const each of canvases.splice(0)) each.remove();
});

describe("a story of the meta's component", () => {
  it("sets its args as inputs, projects its # args, and calls the handler of its output", async () => {
    const element = canvas();
    const pressed = vi.fn();
    const args = { title: "Plans", "#[header]": "Head", "#default": "Body", pressed };
    const story = angularRenderer.mount(element, drawing({}, args, { component: Card }), () => undefined);
    await story.drawn;
    expect(element.querySelector("fb-card h1")?.textContent).toBe("Plans");
    expect(element.querySelector("header")?.textContent).toBe("Head");
    expect(element.querySelector("main")?.textContent).toBe("Body");
    element.querySelector("button")?.click();
    expect(pressed).toHaveBeenCalledWith(1);
    story.unmount();
  });

  it("keeps its state when the args change, and its content follows them", async () => {
    const element = canvas();
    const args = { title: "Plans", "#default": "Body" };
    const story = angularRenderer.mount(element, drawing({}, args, { component: Card }), () => undefined);
    await story.drawn;
    element.querySelector("button")?.click();
    await settled(() => element.textContent?.includes("Pressed 1") === true);
    story.update(drawing({}, { title: "Dates", "#default": "Other" }, { component: Card }));
    await settled(() => element.querySelector("h1")?.textContent === "Dates");
    expect(element.querySelector("main")?.textContent).toBe("Other");
    expect(element.textContent).toContain("Pressed 1");
    story.unmount();
  });

  it("gives the component the providers of the story's metadata and of its application", async () => {
    const element = canvas();
    const provided: StoryDrawing = {
      ...drawing(
        { decorators: [moduleMetadata({ providers: [{ provide: WHO, useValue: "Ada" }] })] },
        {},
        { component: Hello }
      ),
      texts: { hello: "Hi {who}" }
    };
    const story = angularRenderer.mount(element, provided, () => undefined);
    await story.drawn;
    expect(element.textContent).toContain("Ada");
    story.unmount();
    const other = canvas();
    const app: StoryDrawing = {
      ...drawing(
        { decorators: [applicationConfig({ providers: [{ provide: WHO, useValue: "Grace" }] })] },
        {},
        { component: Hello }
      ),
      texts: { hello: "Hi {who}" }
    };
    const second = angularRenderer.mount(other, app, () => undefined);
    await second.drawn;
    expect(other.textContent).toContain("Grace");
    second.unmount();
  });

  it("follows the story's texts and clock", async () => {
    const element = canvas();
    const first: StoryDrawing = {
      ...drawing({}, {}, { component: Hello }),
      texts: { hello: "Hello {who}" },
      clock: heldStoryClock(5)
    };
    const story = angularRenderer.mount(element, first, () => undefined);
    await story.drawn;
    expect(element.textContent?.trim()).toBe("Hello nobody 5");
    story.update({ ...first, texts: { hello: "Ciao {who}" }, clock: heldStoryClock(9) });
    await settled(() => element.textContent?.trim() === "Ciao nobody 9");
    story.unmount();
  });
});

describe("a story with a template", () => {
  it("draws a render's template with its props, and keeps its state when they change", async () => {
    const element = canvas();
    const render = (args: Readonly<Record<string, unknown>>): unknown => ({
      props: args,
      template: `<fb-card [title]="title">{{ body }}</fb-card>`
    });
    const story = angularRenderer.mount(
      element,
      drawing({ render }, { title: "One", body: "Inside" }, { component: Card }),
      () => undefined
    );
    await story.drawn;
    expect(element.querySelector("main")?.textContent).toBe("Inside");
    element.querySelector("button")?.click();
    await settled(() => element.textContent?.includes("Pressed 1") === true);
    story.update(drawing({ render }, { title: "Two", body: "Inside" }, { component: Card }));
    await settled(() => element.querySelector("h1")?.textContent === "Two");
    expect(element.textContent).toContain("Pressed 1");
    story.unmount();
  });

  it("binds the args argsToTemplate writes, outputs included, leaving out what is undefined", async () => {
    const element = canvas();
    const pressed = vi.fn();
    const render = (args: Readonly<Record<string, unknown>>): unknown => ({
      props: args,
      template: `<fb-card ${argsToTemplate(args)}></fb-card>`
    });
    const story = angularRenderer.mount(
      element,
      drawing({ render }, { title: "Bound", pressed, missing: undefined }, { component: Card }),
      () => undefined
    );
    await story.drawn;
    expect(element.querySelector("h1")?.textContent).toBe("Bound");
    element.querySelector("button")?.click();
    expect(pressed).toHaveBeenCalledWith(1);
    expect(argsToTemplate({ a: 1, b: undefined, c: () => undefined }, { exclude: ["a"] })).toBe(
      '(c)="c($event)"'
    );
    story.unmount();
  });

  it("never writes an arg that is not a name into a template, as a crafted address could send one", async () => {
    const element = canvas();
    const injected = 'title]="constructor.constructor(label)()"><!----';
    const render = (args: Readonly<Record<string, unknown>>): unknown => ({
      props: args,
      template: `<fb-card ${argsToTemplate(args)}></fb-card>`
    });
    const args = {
      title: "Safe",
      label: "globalThis.forgebookInjected = true",
      [injected]: "v",
      "#default": "x"
    };
    expect(argsToTemplate(args)).toBe('[title]="title" [label]="label"');
    const story = angularRenderer.mount(
      element,
      drawing({ render }, args, { component: Card }),
      () => undefined
    );
    await story.drawn;
    expect(element.querySelector("h1")?.textContent).toBe("Safe");
    expect(Reflect.get(globalThis, "forgebookInjected")).toBeUndefined();
    story.unmount();
  });

  it("wraps the component's story in a decorator's markup and in a component", async () => {
    const element = canvas();
    const decorators = [
      componentWrapperDecorator((story) => `<section class="outer">${story}</section>`),
      componentWrapperDecorator(Frame, { tone: "loud" })
    ];
    const story = angularRenderer.mount(
      element,
      drawing({ decorators }, { title: "Wrapped" }, { component: Card }),
      () => undefined
    );
    await story.drawn;
    expect(element.querySelector('.frame[data-tone="loud"] fb-card h1')?.textContent).toBe("Wrapped");
    story.unmount();
  });

  it("compiles a template with the declarations and imports of its metadata", async () => {
    const element = canvas();
    const declared = drawing({
      render: () => ({ template: `<fb-legacy word="declared" />` }),
      decorators: [moduleMetadata({ declarations: [Legacy] })]
    });
    const story = angularRenderer.mount(element, declared, () => undefined);
    await story.drawn;
    expect(element.textContent).toContain("declared");
    story.unmount();
    const other = canvas();
    const imported = drawing({
      render: () => ({ template: `<fb-older word="imported" />`, moduleMetadata: { imports: [OlderModule] } })
    });
    const second = angularRenderer.mount(other, imported, () => undefined);
    await second.drawn;
    expect(other.textContent).toContain("imported");
    second.unmount();
  });

  it("hands the frame a template that does not compile", async () => {
    const errors: Error[] = [];
    const story = angularRenderer.mount(
      canvas(),
      drawing({ render: () => ({ template: "<p>{{ 1 + }}</p>" }) }),
      (error) => errors.push(error)
    );
    await settled(() => errors.length > 0);
    story.unmount();
  });
});

describe("a story taken away while it is drawn", () => {
  it("leaves nothing in its canvas and says nothing after, whenever it is taken away", async () => {
    let lateErrors = 0;
    const left: HTMLElement[] = [];
    const template = drawing({ render: () => ({ template: "<p>Drawn</p>" }) });
    const failing = drawing({ render: () => ({ template: "<p>{{ 1 + }}</p>" }) });
    // every moment of a template story's first drawing: compiling, starting its application, drawing
    for (let ticks = 0; ticks < 60; ticks += 1) {
      for (const each of [template, failing]) {
        const element = canvas();
        left.push(element);
        let isTakenAway = false;
        const story = angularRenderer.mount(element, each, () => {
          if (isTakenAway) lateErrors += 1;
        });
        for (let tick = 0; tick < ticks; tick += 1) await Promise.resolve();
        story.unmount();
        isTakenAway = true;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(left.filter((element) => element.textContent !== "")).toEqual([]);
    expect(lateErrors).toBe(0);
  });
});

describe("the server render", () => {
  it("draws the component with its args and projected content, and a wrapped template", async () => {
    const html = await angularRenderer.renderToString(
      drawing({}, { title: "Server", "#default": "Body" }, { component: Card })
    );
    expect(html).toContain("<h1>Server</h1>");
    expect(html).toContain("Body");
    const wrapped = await angularRenderer.renderToString(
      drawing({ decorators: [componentWrapperDecorator(Frame)] }, { title: "Framed" }, { component: Card })
    );
    expect(wrapped).toMatch(/class="frame"[^>]*>.*Framed/s);
  });

  it("reads the story's providers, texts and clock", async () => {
    const provided: StoryDrawing = {
      ...drawing(
        { decorators: [applicationConfig({ providers: [{ provide: WHO, useValue: "Ada" }] })] },
        {},
        { component: Hello }
      ),
      texts: { hello: "Hi {who}" },
      clock: heldStoryClock(7)
    };
    expect(await angularRenderer.renderToString(provided)).toContain("Hi Ada 7");
  });
});
