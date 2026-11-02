/**
 * The plugins' frame modules in a story's frame: each made once with what reaches its tab, and what they run around the
 * story, gathered.
 *
 * @module
 */
import type { FrameMessage } from "../messages.ts";
import { type CreatePluginFrame, type JsonValue, PLUGIN_API_VERSION } from "../plugin.ts";
import type { LoadedBeforeEach, LoadedDecorator } from "./storyModule.ts";

/** A plugin with a frame module, as the generated frame hands it over. */
export type FramePlugin = {
  /** The plugin's id. */
  readonly id: string;
  /** What its frame module exports as `frame`. */
  readonly create: CreatePluginFrame;
};

/** What the plugins run around a story. */
export type PluginFrames = {
  /** Their decorators, in the order of `plugins`. */
  readonly decorators: readonly LoadedDecorator[];
  /** What they prepare before every mount, in the order of `plugins`. */
  readonly setups: readonly LoadedBeforeEach[];
};

/**
 * Makes the plugins' frame modules.
 *
 * @param plugins - the plugins with one.
 * @param storyId - the frame's story.
 * @param tell - tells the shell.
 */
export const startPluginFrames = (
  plugins: readonly FramePlugin[],
  storyId: string,
  tell: (message: FrameMessage) => void
): PluginFrames => {
  const frames = plugins.map((plugin) =>
    plugin.create({
      apiVersion: PLUGIN_API_VERSION,
      report: (value: JsonValue, hint?: string): void =>
        tell({ type: "forgebook:plugin", storyId, plugin: plugin.id, value, hint: hint ?? null })
    })
  );
  return {
    decorators: frames.flatMap((frame) => frame.decorators ?? []),
    setups: frames.flatMap((frame) => (frame.prepare === undefined ? [] : [frame.prepare]))
  };
};
