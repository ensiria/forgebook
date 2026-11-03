/**
 * The probe's frame module: reports each mount to its tab, and marks a story with the switch's value.
 *
 * @module
 */
import type { StoryContext } from "@forgebook/story-format/csf";
import {
  definePluginFrame,
  type PluginFrame,
  type PluginFrameHost,
  type PluginPrepareContext
} from "forgebook/plugin";
import { isValidElement } from "react";

/** Args, as a plugin's decorator reads them for any story. */
type LoadedArgs = Readonly<Record<string, unknown>>;

/** The event a test sends the frame for one more report. */
const REPORT_EVENT = "probe:report";

/** How many reports the frame made. */
let reports = 0;

/** The probe's frame. */
export const frame = definePluginFrame(
  ({ report }: PluginFrameHost): PluginFrame => ({
    prepare: ({ parameters }: PluginPrepareContext): (() => void) | undefined => {
      if (parameters["probe"] === undefined) return undefined;
      const tell = (): void => {
        reports += 1;
        report({ reports }, { hint: String(reports) });
      };
      tell();
      window.addEventListener(REPORT_EVENT, tell);
      return (): void => window.removeEventListener(REPORT_EVENT, tell);
    },
    decorators: [
      (story: () => unknown, context: StoryContext<LoadedArgs>): unknown => {
        const drawn = story();
        if (context.parameters["probe"] === undefined || !isValidElement(drawn)) return drawn;
        return (
          <div data-testid="probe-decorator" data-probe={context.globals["probe"]}>
            {drawn}
          </div>
        );
      }
    ]
  })
);
