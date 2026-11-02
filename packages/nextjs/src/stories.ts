/**
 * The story types for a Next.js project: React's, a server component among the components a meta may show, with the
 * `parameters.nextjs` a story sets its route and request with (`import type { Meta, Story } from "@forgebook/nextjs"`).
 *
 * @remarks
 * `navigation` and `router` are written as Storybook's Next.js framework writes them, so a story moved from Storybook
 * keeps its route; `params`, `headers`, `cookies` and `draftMode` are Forgebook's. Both routers read the same route,
 * so a story sets the one its component reads, and `appDirectory` is not needed (it is read, and changes nothing).
 * Types only.
 *
 * @module
 */
import type { AnyComponent, NoComponent, Preview as ReactPreview, ReactRenderer } from "@forgebook/react";
import type { CsfMeta, CsfStory, StoryParameters, WrittenArg } from "@forgebook/story-format/csf";
import type { ReactNode } from "react";

import type { NavigationParameters, RouterParameters } from "./route.ts";

/** A story's Next.js settings: its route and the request its server code reads. */
export type NextjsParameters = {
  /** Storybook's switch between the two routers: read, and not needed, since both read the story's route. */
  readonly appDirectory?: boolean;
  /** The App Router's route: `usePathname`, `useSearchParams`, `useParams`, the layout segments. */
  readonly navigation?: NavigationParameters;
  /** The Pages Router's route: `useRouter().pathname`, `asPath`, `query`, the locales. */
  readonly router?: RouterParameters;
  /** The request's headers `headers()` returns, by name. */
  readonly headers?: Readonly<Record<string, string>>;
  /** The request's cookies `cookies()` returns, by name. */
  readonly cookies?: Readonly<Record<string, string>>;
  /** Whether `draftMode().isEnabled`; `false` by default. */
  readonly draftMode?: boolean;
};

/** A story's parameters: the catalogue's settings, and its Next.js ones. */
export type NextStoryParameters = StoryParameters & {
  /** The story's route and request. */
  readonly nextjs?: NextjsParameters;
};

/** A server component: an async function component; its parameter is `never` so one of any props is assignable. */
export type ServerComponent = (props: never) => Promise<ReactNode>;

/** A component a Next.js story shows: a client component, or a server component. */
export type NextComponent = AnyComponent | ServerComponent;

/** A component's props. */
type PropsOf<TComponent extends NextComponent> = TComponent extends (props: infer TProps) => unknown
  ? TProps
  : never;

/** A component's props, every one optional: what a story's args may set, and what its render receives. */
export type ArgsOf<TComponent extends NextComponent> = Partial<PropsOf<TComponent>>;

/** What a story's `args` may write: the props, every one optional, a text prop also as `storyText("key")`. */
export type WrittenArgsOf<TComponent extends NextComponent> = {
  [TName in keyof PropsOf<TComponent>]?: WrittenArg<PropsOf<TComponent>[TName]>;
};

/** A story file's default export: `{ title, component, parameters: { nextjs } } satisfies Meta<typeof Nav>`. */
export type Meta<TComponent extends NextComponent = NoComponent> = Omit<
  CsfMeta<ReactRenderer, TComponent, ArgsOf<TComponent>, WrittenArgsOf<TComponent>>,
  "parameters"
> & {
  /** Settings for every story of the file, its route among them. */
  readonly parameters?: NextStoryParameters;
};

/** A story: a named export of a story file. */
export type Story<TComponent extends NextComponent = NoComponent> = Omit<
  CsfStory<ReactRenderer, ArgsOf<TComponent>, WrittenArgsOf<TComponent>>,
  "parameters"
> & {
  /** Settings over the meta's, its route among them. */
  readonly parameters?: NextStoryParameters;
};

/** A Next.js catalogue's preview (`forgebook.preview.ts`): React's, with a route every story starts from. */
export type Preview = Omit<ReactPreview, "parameters"> & {
  /** Settings every story starts from, a route among them. */
  readonly parameters?: NextStoryParameters;
};
