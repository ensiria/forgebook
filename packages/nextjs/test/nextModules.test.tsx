/**
 * Tests for the stand-ins of Next.js's modules: the routers' hooks follow the story's route, a link moves it, the
 * request functions read the story's request, and the cache records what a server action revalidates.
 *
 * @module
 */
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import * as cache from "../src/next/cache.ts";
import Form from "../src/next/form.tsx";
import { cookies, draftMode, headers } from "../src/next/headers.ts";
import Link from "../src/next/link.tsx";
import {
  NextNavigationError,
  notFound,
  ReadonlyURLSearchParams,
  redirect,
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
  useSelectedLayoutSegment
} from "../src/next/navigation.ts";
import Router, { useRouter as usePagesRouter } from "../src/next/router.tsx";
import { createRouteStore, setCurrentStore } from "../src/routeStore.ts";
import { storyRoute } from "../src/storyRoute.ts";

// React's act, in a simulated page: the updates it wraps are committed when it returns
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

/** The page's canvases, emptied after each test. */
const canvases: HTMLElement[] = [];

afterEach(() => {
  for (const canvas of canvases.splice(0)) canvas.remove();
});

/**
 * Draws a node in a new canvas, as a story.
 *
 * @param node - the node.
 * @param parameters - the story's parameters, which give its route and request.
 */
const draw = async (
  node: ReactNode,
  parameters: Readonly<Record<string, unknown>> = {}
): Promise<HTMLElement> => {
  const reported: string[] = [];
  setCurrentStore(createRouteStore(parameters, (name) => reported.push(name)));
  const canvas = document.createElement("div");
  document.body.append(canvas);
  canvases.push(canvas);
  await act(async () => createRoot(canvas).render(node));
  return canvas;
};

/** A component reading every App Router hook. */
const Where = (): ReactNode => {
  const pathname = usePathname();
  const search = useSearchParams();
  const params = useParams();
  const segment = useSelectedLayoutSegment();
  return (
    <p>
      {pathname} {search.toString()} {JSON.stringify(params)} {segment}
    </p>
  );
};

/** The routers the components below were given, for the tests to call. */
const seen: {
  appRouter?: ReturnType<typeof useRouter>;
  pagesRouter?: ReturnType<typeof usePagesRouter>;
} = {};

/** A component that keeps the App Router's router and shows where it is. */
const Moving = (): ReactNode => {
  seen.appRouter = useRouter();
  return <Where />;
};

/** A Pages Router page that keeps its router and shows its route. */
const Page = (): ReactNode => {
  const router = usePagesRouter();
  seen.pagesRouter = router;
  return <p>{`${router.pathname} ${router.asPath} ${JSON.stringify(router.query)}`}</p>;
};

describe("next/navigation", () => {
  it("reads the story's route, and its router moves it", async () => {
    const canvas = await draw(<Moving />, {
      nextjs: { navigation: { pathname: "/blog/a", query: { q: "x" }, segments: [["slug", "a"]] } }
    });
    expect(canvas.textContent).toBe('/blog/a q=x {"slug":"a"} a');
    await act(async () => seen.appRouter?.push("/about?from=nav"));
    expect(canvas.textContent).toBe('/about from=nav {"slug":"a"} a');
    await act(async () => seen.appRouter?.back());
    expect(canvas.textContent).toContain("/blog/a q=x");
    expect(storyRoute().calls.map((call) => call.name)).toEqual(["router.push", "router.back"]);
  });

  it("keeps search params read-only, and stops a story where Next.js would go elsewhere", () => {
    setCurrentStore(createRouteStore({}, undefined));
    const search = new ReadonlyURLSearchParams("a=1");
    expect(() => search.set("a", "2")).toThrow("ReadonlyURLSearchParams");
    expect(search.get("a")).toBe("1");
    expect(() => redirect("/login")).toThrow(NextNavigationError);
    expect(() => notFound()).toThrow("not-found page");
    expect(storyRoute().calls.map((call) => call.name)).toEqual([
      "navigation.redirect",
      "navigation.notFound"
    ]);
  });
});

describe("next/link", () => {
  it("moves the route on a plain click, and leaves another tab or origin to the browser", async () => {
    const canvas = await draw(
      <>
        <Link href={{ pathname: "/blog/[slug]", query: { slug: "b" } }}>Post</Link>
        <Link href="https://example.com/">Away</Link>
        <Where />
      </>
    );
    const [post, away] = [...canvas.querySelectorAll("a")];
    expect(post?.getAttribute("href")).toBe("/blog/b");
    await act(async () =>
      post?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }))
    );
    expect(canvas.querySelector("p")?.textContent).toContain("/ ");
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    await act(async () => post?.dispatchEvent(click));
    expect(click.defaultPrevented).toBe(true);
    expect(canvas.querySelector("p")?.textContent).toBe('/blog/b  {"slug":"b"} ');
    const leave = new MouseEvent("click", { bubbles: true, cancelable: true });
    away?.addEventListener("click", (event) => event.preventDefault());
    await act(async () => away?.dispatchEvent(leave));
    expect(storyRoute().pathname).toBe("/blog/b");
  });

  it("gives a legacy child the href and the click", async () => {
    const canvas = await draw(
      <Link href="/about" legacyBehavior passHref>
        {/* biome-ignore lint/a11y/useValidAnchor: the legacy child gets its href from the link, as in Next.js */}
        <a className="legacy">About</a>
      </Link>
    );
    const anchor = canvas.querySelector("a.legacy");
    expect(anchor?.getAttribute("href")).toBe("/about");
    await act(async () =>
      anchor?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    );
    expect(storyRoute().pathname).toBe("/about");
  });
});

describe("next/router", () => {
  it("reads the Pages Router's route and moves it around its events", async () => {
    const canvas = await draw(<Page />, {
      nextjs: { router: { pathname: "/blog/[slug]", query: { slug: "a" }, locale: "it" } }
    });
    expect(canvas.textContent).toBe('/blog/[slug] /blog/a {"slug":"a"}');
    const events: string[] = [];
    const listen = (url: string): void => {
      events.push(url);
    };
    Router.events.on("routeChangeComplete", listen);
    await act(async () => {
      await seen.pagesRouter?.push({ pathname: "/blog/[slug]", query: { slug: "b", tab: "1" } });
    });
    Router.events.off("routeChangeComplete", listen);
    expect(canvas.textContent).toBe('/blog/[slug] /blog/b?tab=1 {"tab":"1","slug":"b"}');
    expect(events).toEqual(["/blog/b?tab=1"]);
    expect([Router.asPath, Router.locale]).toEqual(["/blog/b?tab=1", "it"]);
  });
});

describe("next/form", () => {
  it("goes to its action with the fields as search params", async () => {
    const canvas = await draw(
      <Form action="/search">
        <input name="q" defaultValue="tides" />
        <button type="submit">Go</button>
      </Form>
    );
    await act(async () => canvas.querySelector("button")?.click());
    expect([storyRoute().pathname, storyRoute().query]).toEqual(["/search", { q: "tides" }]);
  });
});

describe("next/headers and next/cache", () => {
  it("read the story's request, and record what changes it", async () => {
    setCurrentStore(
      createRouteStore(
        { nextjs: { headers: { "accept-language": "it" }, cookies: { theme: "dark" } } },
        undefined
      )
    );
    expect((await headers()).get("accept-language")).toBe("it");
    const jar = await cookies();
    expect([jar.get("theme")?.value, jar.has("missing"), jar.size]).toEqual(["dark", false, 1]);
    jar.set("theme", "light").delete({ name: "theme" });
    expect(jar.getAll()).toEqual([]);
    const draft = await draftMode();
    draft.enable();
    expect((await draftMode()).isEnabled).toBe(true);
    cache.revalidatePath("/blog", "page");
    const doubled = cache.unstable_cache(async (value: number) => value * 2);
    expect(await doubled(2)).toBe(4);
    expect(storyRoute().calls.map((call) => `${call.name}(${call.values.join(",")})`)).toEqual([
      "cookies.set(theme,light)",
      "cookies.delete(theme)",
      "draftMode.enable()",
      "cache.revalidatePath(/blog,page)"
    ]);
  });
});
