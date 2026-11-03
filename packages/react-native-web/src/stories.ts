/**
 * The story types for a React Native project (`import type { Meta, Story } from "@forgebook/react-native-web"`):
 * React's, since a React Native component is a React component and its story is a React story.
 *
 * @remarks
 * Named here so a project installs one package and its story files name the platform they are written for; each is
 * React's type under the same name, so a story file can move between the two without a change. Types only.
 *
 * @module
 */
import type {
  AnyComponent,
  AnyFunction,
  NoComponent,
  Decorator as ReactDecorator,
  LogicMeta as ReactLogicMeta,
  LogicStory as ReactLogicStory,
  Meta as ReactMeta,
  Preview as ReactPreview,
  Story as ReactStory
} from "@forgebook/react";

/** A React Native story file's default export: `{ title, component, args… } satisfies Meta<typeof Card>`. */
export type Meta<TComponent extends AnyComponent = NoComponent> = ReactMeta<TComponent>;

/** A React Native story: a named export of a story file. */
export type Story<TComponent extends AnyComponent = NoComponent> = ReactStory<TComponent>;

/** The default export of a story file about a hook, written `satisfies LogicMeta<typeof useCart>`. */
export type LogicMeta<TFunction extends AnyFunction> = ReactLogicMeta<TFunction>;

/** A story about a hook: a `render` that draws a scene using it. */
export type LogicStory = ReactLogicStory;

/** Wraps a React Native story: a provider (safe areas, a theme), a container of a given size. */
export type Decorator<TArgs> = ReactDecorator<TArgs>;

/**
 * A React Native catalogue's preview (`forgebook.preview.tsx`): decorators around every story (the providers the app
 * puts at its root, a `SafeAreaProvider` among them), parameters under every meta's, a setup before any story.
 */
export type Preview = ReactPreview;
