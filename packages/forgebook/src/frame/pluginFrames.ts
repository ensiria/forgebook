/**
 * The plugins' frame modules in a story's frame: each made once with what reaches its tab, and what they run around the
 * story, gathered.
 *
 * @module
 */
import type { FrameMessage, ShellMessage } from "../messages.ts";
import type { CreatePluginFrame, JsonValue, PluginReportOptions } from "../plugin.ts";
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
  /**
   * Hands what a plugin's tab sent to that plugin's frame module; nothing for a plugin with none, or none that receives.
   *
   * @param plugin - the plugin's id.
   * @param value - what the tab sent.
   */
  readonly receive: (plugin: string, value: JsonValue) => void;
  /**
   * Takes a message from the shell when it is a plugin's own, handing it to that plugin's frame module.
   *
   * @param message - the message.
   * @returns whether it was a plugin's.
   */
  readonly take: (message: ShellMessage) => boolean;
};

/**
 * Makes the plugins' frame modules.
 *
 * @param plugins - the plugins with one; none when the catalogue lists none.
 * @param storyId - the frame's story.
 * @param tell - tells the shell.
 * @param reportError - where what a frame module's `receive` throws goes: the page's error handler, which leaves the story
 *   as it is.
 */
export const startPluginFrames = (
  plugins: readonly FramePlugin[] | undefined,
  storyId: string,
  tell: (message: FrameMessage) => void,
  reportError: (error: unknown) => void = (error: unknown): void => window.reportError(error)
): PluginFrames => {
  const frames = (plugins ?? []).map((plugin) => ({
    id: plugin.id,
    ...plugin.create({
      report: (value: JsonValue, options: PluginReportOptions = {}): void =>
        tell({
          type: "forgebook:plugin",
          storyId,
          plugin: plugin.id,
          value,
          hint: options.hint ?? null,
          tab: options.tab ?? null
        })
    })
  }));
  const receive = (plugin: string, value: JsonValue): void => {
    const frame = frames.find((each) => each.id === plugin);
    try {
      frame?.receive?.(value);
    } catch (error) {
      reportError(error);
    }
  };
  return {
    decorators: frames.flatMap((frame) => frame.decorators ?? []),
    setups: frames.flatMap((frame) => (frame.prepare === undefined ? [] : [frame.prepare])),
    receive,
    take: (message: ShellMessage): boolean => {
      if (message.type !== "forgebook:plugin-message") return false;
      receive(message.plugin, message.value);
      return true;
    }
  };
};
