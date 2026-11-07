/**
 * What `forgebook check --stress` and `check_story` with `stress` run: the cases of each story an id names, built from its
 * props and the catalogue's switches (`stressCases.ts`), drawn by `@forgebook/testing/stress` against the served catalogue.
 *
 * @module
 */
import { deviceDefaultOf, NO_DEVICE } from "../../src/deviceView.ts";
import { isStressReport, type StressReport, type StressRequest } from "../../src/storyCheck.ts";
import { catalogueSwitches } from "../../src/switches.ts";
import { isStoryDocument } from "../../src/vite/agentApi.ts";
import { AGENT_API } from "../../src/vite/agentRoutes.ts";
import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { servedCatalogue } from "./agentClient.ts";
import { storiesAt, storiesNamed, testingFunction } from "./storyCheckRun.ts";
import { stressPlan } from "./stressCases.ts";

/**
 * Runs the stress matrix on the stories an id names: each drawn plain, then with worst-case values and views it never
 * declared, and what each case breaks that the plain story does not.
 *
 * @param config - the catalogue's configuration.
 * @param url - where `forgebook dev` runs, when not at Vite's default address.
 * @param id - a story's id, or a component's for its listed stories.
 * @returns the report, or why it could not run.
 */
export const runStoryStress = async (
  config: ResolvedConfig,
  url: string | undefined,
  id: string
): Promise<StressReport | string> => {
  const call = await testingFunction(config.dir, "@forgebook/testing/stress", "stressStories");
  if (typeof call === "string") return call;
  const switches = catalogueSwitches(config.switches, config.languages, config.lists.controls);
  const served = await servedCatalogue(config, url);
  try {
    const document = await storiesAt(served.origin);
    if (typeof document === "string") return document;
    const stories = storiesNamed(document, id, deviceDefaultOf(NO_DEVICE, config.lists.device));
    if (stories.length === 0) return `No story or component "${id}"`;
    const planned = await Promise.all(
      stories.map(async (story) => {
        const response = await fetch(`${served.origin}${AGENT_API}story?id=${encodeURIComponent(story.id)}`);
        const body: unknown = await response.json();
        return isStoryDocument(body) ? { story, plan: stressPlan(body.controls, switches) } : story.id;
      })
    );
    const unread = planned.filter((each) => typeof each === "string");
    if (unread.length > 0) return `The catalogue could not say what these stories take: ${unread.join(", ")}`;
    const plans = planned.filter((each) => typeof each !== "string");
    const request: StressRequest = {
      frameUrl: `${served.origin}/frame.html`,
      stories: plans.map(({ story, plan }) => ({ story, cases: plan.cases })),
      switches,
      lists: config.lists
    };
    const answer = await call(request);
    if (!isStressReport(answer))
      return "@forgebook/testing/stress answered something that is not a stress report";
    const skipped = plans.flatMap(({ story, plan }) => plan.skipped.map((each) => `${story.id}: ${each}`));
    return { ...answer, skipped };
  } finally {
    await served.close();
  }
};
