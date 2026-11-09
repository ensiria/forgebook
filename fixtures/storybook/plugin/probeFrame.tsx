/**
 * The probe's frame module: reports each mount to its tab, and what the tab sends it, and marks a story with the switch's
 * value.
 *
 * @module
 */
import type { StoryContext } from "@forgebook/story-format/csf";
import {
  definePluginFrame,
  type JsonValue,
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

/** What the tab sent last; none before it sent. */
let received: unknown;

/** The probe's frame. */
export const frame = definePluginFrame(
  ({ report }: PluginFrameHost): PluginFrame => ({
    prepare: ({ parameters }: PluginPrepareContext): (() => void) | undefined => {
      if (parameters["probe"] === undefined) return undefined;
      const tell = (): void => {
        reports += 1;
        report({ reports, ...(received === undefined ? {} : { received }) }, { hint: String(reports) });
      };
      tell();
      window.addEventListener(REPORT_EVENT, tell);
      return (): void => window.removeEventListener(REPORT_EVENT, tell);
    },
    // what the tab sends comes back in the next report, so the tab sees the round trip
    receive: (value: JsonValue): void => {
      received = value;
      reports += 1;
      report({ reports, received }, { hint: String(reports) });
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
