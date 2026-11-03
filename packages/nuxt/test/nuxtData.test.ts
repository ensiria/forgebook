/**
 * Tests for the data a story's components fetch: `useFetch`'s key and its reactive request, overlapping runs, lazy
 * calls, a failed key started again, and clearing back to the default.
 *
 * @module
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref, type VNode } from "vue";

import { clearNuxtData, useAsyncData, useLazyAsyncData } from "../src/app/data.ts";
import { useFetch } from "../src/app/fetch.ts";
import { storyNuxt } from "../src/storyNuxt.ts";
import { drawing, drawn, settled, takeAway } from "./drawStory.ts";

afterEach(() => {
  takeAway();
  vi.unstubAllGlobals();
});

/** The addresses the page fetched, answered with the page asked for. */
const stubFetch = (): string[] => {
  const fetched: string[] = [];
  vi.stubGlobal("fetch", async (url: string): Promise<Response> => {
    fetched.push(url);
    return Response.json({ page: new URL(url, "http://shop.invalid").searchParams.get("page") });
  });
  return fetched;
};

describe("useFetch", () => {
  it("reads a query whose values are refs, and fetches again under another key when one changes", async () => {
    const fetched = stubFetch();
    const page = ref(1);
    const Reader = defineComponent(async () => {
      const { data } = await useFetch<{ readonly page: string }>("/api/products", { query: { page } });
      return (): VNode => h("p", data.value?.page ?? "");
    });
    const element = await drawn(drawing(() => h(Reader)));
    expect(element.textContent).toBe("1");
    page.value = 2;
    await settled();
    expect(element.textContent).toBe("2");
    expect(fetched).toEqual(["/api/products?page=1", "/api/products?page=2"]);
    expect(Object.keys(storyNuxt().data)).toEqual(["/api/products?page=1", "/api/products?page=2"]);
  });

  it("keys a request by its method and body too", async () => {
    stubFetch();
    const Reader = defineComponent(async () => {
      await useFetch("/api/cart", { method: "post", body: { id: 1 } });
      return (): VNode => h("p");
    });
    await drawn(drawing(() => h(Reader)));
    expect(Object.keys(storyNuxt().data)).toEqual(['POST /api/cart {"id":1}']);
  });
});

describe("a key's runs", () => {
  it("keeps the latest run's result when an earlier one ends after it, and aborts the earlier", async () => {
    const answers: ((value: string) => void)[] = [];
    const signals: AbortSignal[] = [];
    let refresh = async (): Promise<void> => undefined;
    const Reader = defineComponent(() => {
      const result = useAsyncData("slow", (_app, { signal }) => {
        signals.push(signal);
        return new Promise<string>((resolve) => answers.push(resolve));
      });
      refresh = result.refresh;
      return (): VNode => h("p", String(result.data.value));
    });
    const element = await drawn(drawing(() => h(Reader)));
    const second = refresh();
    answers[1]?.("latest");
    await second;
    answers[0]?.("stale");
    await settled();
    expect(element.textContent).toBe("latest");
    expect(signals[0]?.aborted).toBe(true);
  });

  it("lets a lazy call be awaited at once, and starts a failed key again", async () => {
    let calls = 0;
    const Reader = defineComponent(async () => {
      const lazy = await useLazyAsyncData("never", () => new Promise<string>(() => undefined));
      const failing = await useAsyncData("failing", async (): Promise<string> => {
        calls += 1;
        throw new Error("down");
      });
      const again = await useAsyncData("failing", async (): Promise<string> => "unused");
      return (): VNode => h("p", `${lazy.status.value} ${failing.status.value} ${again.status.value}`);
    });
    // the second call of the failed key runs again, and its success is the key's
    expect((await drawn(drawing(() => h(Reader)))).textContent).toBe("pending success success");
    expect(calls).toBe(1);
  });

  it("clears a key back to its default", async () => {
    const Reader = defineComponent(async () => {
      const { data } = await useAsyncData("list", async () => ["a"], { default: () => [] });
      return (): VNode => h("p", JSON.stringify(data.value));
    });
    const element = await drawn(drawing(() => h(Reader)));
    expect(element.textContent).toBe('["a"]');
    clearNuxtData("list");
    await nextTick();
    expect(element.textContent).toBe("[]");
  });
});
