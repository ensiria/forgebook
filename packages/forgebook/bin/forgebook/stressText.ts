/**
 * What a stress run says to a person, and when it fails.
 *
 * @module
 */
import type { StressReport } from "../../src/storyCheck.ts";
import type { McpToolResult } from "../../src/vite/mcpProtocol.ts";

/**
 * Whether a run found what a case breaks, or a case it could not judge.
 *
 * @param report - the run.
 */
export const isStressFailure = (report: StressReport): boolean =>
  report.cases.some(
    (each) => each.name !== "plain" && (each.problems.length > 0 || each.notVerified !== undefined)
  );

/**
 * The run, a line per problem a case adds, then one line that sums it up.
 *
 * @param report - the run.
 */
export const stressText = (report: StressReport): string => {
  const cases = report.cases.filter((each) => each.name !== "plain");
  const lines = cases.flatMap((each) => [
    ...(each.notVerified === undefined
      ? []
      : [`${each.storyId} ${each.name}: not judged: ${each.notVerified}`]),
    ...each.problems.map((problem) => `${each.storyId} ${each.name}: ${problem.message}`)
  ]);
  const breaking = cases.filter((each) => each.problems.length > 0).length;
  return [
    ...lines,
    ...(report.skipped ?? []).map((each) => `not run: ${each}`),
    `${cases.length} cases, ${breaking} break what the plain story does not`
  ].join("\n");
};

/**
 * What `check_story` answers with `stress`: the run, an error when a case breaks something, and a refusal of the options
 * it does not take, since it chooses its own values and views.
 *
 * @param stress - runs the stress matrix on an id.
 * @param args - the tool's arguments.
 */
export const stressToolResult = async (
  stress: (id: string) => Promise<StressReport | string>,
  args: Readonly<Record<string, unknown>>
): Promise<McpToolResult> => {
  if (args["views"] !== undefined || args["allVariants"] === true || args["semantic"] === true)
    return {
      structured: {
        error: "stress chooses its own values and views: leave out views, allVariants and semantic"
      },
      isError: true
    };
  const stressed = await stress(typeof args["id"] === "string" ? args["id"] : "");
  if (typeof stressed === "string") return { structured: { error: stressed }, isError: true };
  return { structured: stressed, isError: isStressFailure(stressed) };
};
