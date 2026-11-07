/**
 * `forgebook proof`: a pull request's states against where it started, drawn in one run, for a comment made by CI.
 *
 * @remarks
 * It exits zero once it has something to say, whatever a picture shows, since a picture that changed is for a person to
 * judge. `--fail-on-verdict` holds it to `verify`'s verdict, so the workflow's check is not green on a failing one.
 *
 * @module
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { EXIT } from "@ensiria/cli-kit/constants";
import { formatJson } from "@ensiria/cli-kit/files";
import { ScriptError } from "@ensiria/cli-kit/script";

import type { ProofDocument, StoriesDocument } from "../../src/vite/agent.types.ts";
import { isChangedStoriesDocument, isStoriesDocument } from "../../src/vite/agentApi.ts";
import { gitOutput } from "../../src/vite/gitChange.ts";
import { type CatalogueClient, catalogueClient } from "./agentClient.ts";
import { COMMAND, configWithStoriesOf, type ForgebookOptions } from "./catalogueCommands.ts";
import { runProof, writeProofFiles } from "./proofRun.ts";
import { proofComment, proofPage } from "./proofText.ts";
import { proofWorkflow, WORKFLOW_FILE } from "./proofWorkflow.ts";
import { runStoriesCheck } from "./storyCheckRun.ts";
import { runVerify } from "./verifyRun.ts";

/** The most stories pictured unless told otherwise: a change to a shared sheet reaches them all. */
const MAX_STORIES = "30";

/** Writes the workflow into the repository the catalogue is in. */
const writeWorkflow = async (dir: string): Promise<void> => {
  const root = (await gitOutput(dir, "rev-parse", "--show-toplevel")).trim();
  const file = join(root, WORKFLOW_FILE);
  if (existsSync(file))
    throw new ScriptError(`${WORKFLOW_FILE} is already there: delete it to write it again`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, proofWorkflow(root, relative(root, dir).replaceAll("\\", "/")));
};

/** The catalogue's stories, or why it gave none. */
const storiesOf = async (client: CatalogueClient): Promise<StoriesDocument | string> => {
  const answer = await client.ask("stories", new URLSearchParams());
  return isStoriesDocument(answer.body)
    ? answer.body
    : `The catalogue answered ${answer.status} for its stories`;
};

/**
 * Every story a change reaches, or why the catalogue gave none. A sheet every component imports reaches every story, and
 * only the first are pictured, so those named after a changed file come first: they are the ones that show it.
 */
const changedIdsOf = async (client: CatalogueClient, since: string): Promise<readonly string[] | string> => {
  const answer = await client.ask("changed", new URLSearchParams({ since }));
  if (!isChangedStoriesDocument(answer.body))
    return `The catalogue answered ${answer.status} for what the change reaches`;
  const ids = answer.body.stories.map((story) => story.id);
  return orderedByName(ids, answer.body.files);
};

/**
 * Stories named after a changed file first, then the rest, each in the catalogue's order.
 *
 * @param ids - the stories' ids.
 * @param files - the changed files.
 */
export const orderedByName = (ids: readonly string[], files: readonly string[]): readonly string[] => {
  const plain = (text: string): string => text.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  const names = files
    .flatMap((file) => {
      const parts = file.split("/");
      const stem = (parts.at(-1) ?? "").split(".")[0] ?? "";
      return [stem === "index" ? "" : stem, parts.at(-2) ?? ""];
    })
    .map(plain)
    .filter((name) => name.length > 2);
  const isNamed = (id: string): boolean => names.some((name) => plain(id).includes(name));
  return [...ids.filter(isNamed), ...ids.filter((id) => !isNamed(id))];
};

/** Stops with a failure when the verdict is one a pipeline stops on and it was asked to. */
const stopOnVerdict = (document: ProofDocument, isAsked: boolean): void => {
  if (isAsked && (document.verdict === "failed" || document.verdict === "not-verified"))
    throw new ScriptError(document.summary, { exitCode: EXIT.failure, isReported: true });
};

/** Writes a proof's files, and gives its comment. */
const writtenProof = (out: string, document: ProofDocument): string => {
  const comment = proofComment(document);
  writeProofFiles(out, {
    "proof.json": formatJson(document),
    "comment.md": comment,
    "index.html": proofPage(document)
  });
  return comment;
};

/** A count an option gives. */
const wholeCount = (text: string | undefined): number => {
  const count = Number(text);
  if (!Number.isInteger(count) || count < 1)
    throw new ScriptError("--max-stories takes a whole number from 1");
  return count;
};

/** An option's folder, absolute, when it gives one. */
const resolved = (folder: string | undefined): string | undefined =>
  folder === undefined ? undefined : resolve(folder);

/**
 * The command.
 *
 * @param forgebook - the scope of the `forgebook` command, whose options every command takes.
 */
export const proofCommands = (
  forgebook: CommandScope<ForgebookOptions>
): Readonly<Record<string, CommandNode>> => ({
  proof: forgebook.command({
    summary:
      "Compare a change's states with where it started, both drawn in this run with nothing stored, and write the pull request's comment and pictures. A changed picture never fails it; --fail-on-verdict stops on verify's verdict.",
    json: true,
    options: {
      base: {
        type: "string",
        valueName: "ref",
        description:
          "The ref to compare with, from where the branch left it; required unless writing the workflow."
      },
      out: {
        type: "string",
        default: "forgebook-proof",
        valueName: "folder",
        description: "The folder for comment.md, proof.json, index.html and the pictures."
      },
      work: {
        type: "string",
        valueName: "folder",
        description:
          "Where the base's checkout goes, while it runs; the system's temporary folder by default."
      },
      install: {
        type: "string",
        valueName: "command",
        description: "What installs the base's checkout; the one its lockfile names by default."
      },
      all: {
        type: "boolean",
        description:
          "Every listed story, not only those the change reaches. With --base HEAD, shows whether two builds of one commit draw the same."
      },
      quick: { type: "boolean", description: "Only the default view of each story; the proof says so." },
      "fail-on-verdict": {
        type: "boolean",
        description: "Exit non-zero, the proof written, when verify's verdict is not-verified or failed."
      },
      "max-stories": {
        type: "string",
        default: MAX_STORIES,
        valueName: "count",
        description: "The most stories pictured; the proof names those past it as not checked."
      },
      "write-workflow": {
        type: "boolean",
        description: `Write ${WORKFLOW_FILE}, for this repository's package manager and this catalogue, and stop.`
      },
      url: {
        type: "string",
        env: "FORGEBOOK_URL",
        valueName: "address",
        description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
      }
    },
    examples: [
      { command: `${COMMAND} proof --write-workflow`, description: "Set it up on a repository." },
      {
        command: `${COMMAND} proof --base origin/main --fail-on-verdict`,
        description: "What the workflow runs."
      },
      {
        command: `${COMMAND} proof --base HEAD --all`,
        description: "Whether this project's pictures hold still between two builds."
      }
    ],
    run: async ({ options, io, log, isJson }): Promise<void> => {
      const config = await configWithStoriesOf(options.config);
      if (options["write-workflow"] === true) {
        await writeWorkflow(config.dir);
        log.success(`${WORKFLOW_FILE} written`);
        return;
      }
      const { base } = options;
      if (base === undefined) throw new ScriptError("Name the ref to compare with: --base origin/main");
      const maxStories = wholeCount(options["max-stories"]);
      const out = resolve(options.out);
      const isQuick = options.quick === true;
      const client = await catalogueClient(config, options.url);
      try {
        const document = await runProof(
          {
            config,
            configFile: options.config,
            say: (text) => log.info(text),
            verify: (since) =>
              runVerify(
                {
                  dir: config.dir,
                  ask: client.ask,
                  check: (input) => runStoriesCheck(config, options.url, input)
                },
                { since, isQuick }
              ),
            stories: () => storiesOf(client),
            changedIds: (since) => changedIdsOf(client, since)
          },
          {
            base,
            out,
            work: resolved(options.work),
            install: options.install,
            isAll: options.all === true,
            isQuick,
            maxStories
          }
        );
        if (typeof document === "string") throw new ScriptError(document);
        const comment = writtenProof(out, document);
        io.stdout.write(isJson ? formatJson(document) : comment);
        for (const each of isJson ? document.notChecked : []) log.warn(each);
        stopOnVerdict(document, options["fail-on-verdict"] === true);
      } finally {
        await client.close();
      }
    }
  })
});
