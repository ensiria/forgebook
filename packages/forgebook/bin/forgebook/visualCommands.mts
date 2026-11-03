/**
 * `forgebook diff`, and what `forgebook mcp` offers for it: a story's pictures against stored baselines, with an exit
 * code for CI.
 *
 * @module
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";

import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { EXIT } from "@ensiria/cli-kit/constants";
import { formatJson } from "@ensiria/cli-kit/files";
import { ScriptError } from "@ensiria/cli-kit/script";

import type { StoryDiffReport, StoryShotReport } from "../../src/storyCheck.ts";
import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import type { McpTool, McpToolResult } from "../../src/vite/mcpProtocol.ts";
import { diffText } from "./agentText.ts";
import { COMMAND, configOf, type ForgebookOptions } from "./catalogueCommands.ts";
import type { StoryCheckInput } from "./storyCheckRun.ts";
import { runStoryDiff, runStoryShot } from "./storyCheckRun.ts";

/** Where baselines are kept unless a command names a folder. */
export const BASELINES_FOLDER = "forgebook-baselines";

/**
 * The folder baselines are kept in, the same whoever asks: the command from any folder, or an agent's tool.
 *
 * @param dir - the catalogue's folder.
 */
export const baselinesOf = (dir: string): string => join(dir, BASELINES_FOLDER);

/**
 * Stores a story's pictures as its baselines, all or none: a story that did not draw would hold a broken picture as the
 * truth, and every later comparison would pass on it.
 *
 * @param config - the catalogue's configuration.
 * @param url - where `forgebook dev` runs.
 * @param input - the id and the views.
 * @param out - the folder, when not the catalogue's own.
 * @returns the pictures, or why they cannot be baselines.
 */
export const updateBaselines = async (
  config: ResolvedConfig,
  url: string | undefined,
  input: StoryCheckInput,
  out: string | undefined
): Promise<StoryShotReport | string> => {
  const folder = out === undefined ? baselinesOf(config.dir) : resolve(out);
  const taken = mkdtempSync(join(tmpdir(), "forgebook-baselines-"));
  try {
    const report = await runStoryShot(config, url, input, taken);
    if (typeof report === "string") return report;
    const broken = report.shots.filter((shot) => shot.status !== undefined);
    if (broken.length > 0) {
      return `No baselines written: ${broken.map((shot) => shot.storyId).join(", ")} did not draw`;
    }
    mkdirSync(folder, { recursive: true });
    const shots = report.shots.map((shot) => {
      const file = join(folder, basename(shot.file));
      copyFileSync(shot.file, file);
      return { ...shot, file };
    });
    return { schema: 1, shots };
  } finally {
    rmSync(taken, { recursive: true, force: true });
  }
};

/** Whether a comparison found what should fail a check: a change, or a story with no baseline to hold it. */
const hasDifference = (report: StoryDiffReport): boolean =>
  report.results.some((each) => each.status !== "same");

/**
 * The command.
 *
 * @param forgebook - the scope of the `forgebook` command.
 */
export const visualCommands = (
  forgebook: CommandScope<ForgebookOptions>
): Readonly<Record<string, CommandNode>> => ({
  diff: forgebook.command({
    summary: "Compare a story's pictures with its baselines: which changed, where and by how much.",
    json: true,
    options: {
      view: {
        type: "string",
        multiple: true,
        valueName: "view",
        description: "A view to compare it in, as forgebook shot takes it."
      },
      "all-variants": {
        type: "boolean",
        description: "Compare every variant the catalogue's browser tests check."
      },
      baselines: {
        type: "string",
        valueName: "folder",
        description: `The folder forgebook shot --update wrote; ${BASELINES_FOLDER} beside the configuration by default.`
      },
      out: {
        type: "string",
        default: "forgebook-diff",
        valueName: "folder",
        description: "The folder the new pictures and the marked ones go in."
      },
      url: {
        type: "string",
        env: "FORGEBOOK_URL",
        valueName: "address",
        description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
      }
    },
    positionals: [
      { name: "id", description: "A story's id, or a component's for its listed stories.", required: true }
    ],
    examples: [
      { command: `${COMMAND} shot kit:data-badge --update`, description: "Store its baselines." },
      { command: `${COMMAND} diff kit:data-badge --json`, description: "Compare it after a change." }
    ],
    run: async ({ args, options, io, isJson, style }): Promise<void> => {
      const config = await configOf(options.config);
      const report = await runStoryDiff(
        config,
        options.url,
        { id: args.id, views: options.view ?? [], isAllVariants: options["all-variants"] === true },
        {
          baselines: options.baselines === undefined ? baselinesOf(config.dir) : resolve(options.baselines),
          outDir: resolve(options.out)
        }
      );
      if (typeof report === "string") throw new ScriptError(report);
      io.stdout.write(
        isJson ? formatJson(report) : `${diffText(report, (file) => relative(process.cwd(), file), style)}\n`
      );
      if (hasDifference(report)) {
        throw new ScriptError("The pictures differ", { exitCode: EXIT.failure, isReported: true });
      }
    }
  })
});

/** The folder a session's pictures go in, emptied for each call, as `story_shot`'s is. */
let toolDir: string | undefined;

/** The folder for a call. */
const toolFolder = (): string => {
  toolDir ??= mkdtempSync(join(tmpdir(), "forgebook-diff-"));
  rmSync(toolDir, { recursive: true, force: true });
  mkdirSync(toolDir, { recursive: true });
  return toolDir;
};

/**
 * The MCP tool.
 *
 * @param diff - what compares, with the baselines' folder as the catalogue keeps it.
 */
export const visualDiffTool = (
  diff: (input: StoryCheckInput, outDir: string) => Promise<StoryDiffReport | string>
): McpTool => ({
  name: "visual_diff",
  description:
    "Compare a story's pictures with the baselines forgebook shot --update stored: which changed, the region, the percentage of pixels, and the marked picture to look at. new means no baseline yet.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "A story's id, or a component's for its listed stories." },
      views: {
        type: "array",
        items: { type: "string" },
        description: "The views to compare it in; the default view when none."
      }
    },
    required: ["id"],
    additionalProperties: false
  },
  call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => {
    const views = Array.isArray(args["views"])
      ? args["views"].filter((view): view is string => typeof view === "string")
      : [];
    const id = typeof args["id"] === "string" ? args["id"] : "";
    const report = await diff({ id, views, isAllVariants: false }, toolFolder());
    if (typeof report === "string") return { structured: { error: report }, isError: true };
    const images = report.results.flatMap((each) =>
      each.diff === undefined
        ? []
        : [{ data: readFileSync(each.diff).toString("base64"), mimeType: "image/png" }]
    );
    return { structured: report, isError: false, images };
  }
});
