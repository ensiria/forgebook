/**
 * The commands that read a catalogue's docs pages: `pages` (the list) and `page` (one, to read).
 *
 * @module
 */
import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { ScriptError } from "@ensiria/cli-kit/script";

import { isPageDocument, isPagesDocument } from "../../src/vite/agentApi.ts";
import { pagesText, pageText } from "./agentText.ts";
import { askCatalogue, COMMAND, configOf, type ForgebookOptions, printAnswer } from "./catalogueCommands.ts";

/** What both commands take. */
const PAGE_OPTIONS = {
  view: {
    type: "string",
    valueName: "query",
    description: "The view the links open in, as the catalogue's address writes it (theme=dark&lang=it)."
  },
  url: {
    type: "string",
    env: "FORGEBOOK_URL",
    valueName: "address",
    description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
  }
} as const;

/**
 * The commands.
 *
 * @param forgebook - the scope of the `forgebook` command, whose options every command takes.
 */
export const pagesCommands = (
  forgebook: CommandScope<ForgebookOptions>
): Readonly<Record<string, CommandNode>> => ({
  pages: forgebook.command({
    summary:
      "List the catalogue's docs pages, with their ids and addresses; fail when the index has problems.",
    json: true,
    options: {
      ...PAGE_OPTIONS,
      source: { type: "string", valueName: "id", description: "Only this source's pages." }
    },
    examples: [
      { command: `${COMMAND} pages`, description: "Every page, in reading order." },
      { command: `${COMMAND} pages --source kit --json`, description: "One library's pages, as JSON." }
    ],
    run: async ({ options, io, log, isJson, style }): Promise<void> => {
      const config = await configOf(options.config);
      const params = new URLSearchParams({ view: options.view ?? "" });
      const body = await askCatalogue(config, options.url, "pages", params, log);
      if (!isPagesDocument(body)) throw new ScriptError("The catalogue's answer has an unexpected shape");
      const { source } = options;
      const pages = body.pages.filter((page) => source === undefined || page.source === source);
      const document = { ...body, pages };
      printAnswer(pagesText(document, style), document, document.problems, { io, log, isJson });
    }
  }),
  page: forgebook.command({
    summary: "Print one docs page: its Markdown, its headings with --json, the address that opens it.",
    json: true,
    options: PAGE_OPTIONS,
    positionals: [
      {
        name: "id",
        description: "The page's id, as forgebook pages lists it; home for the catalogue's written home.",
        required: true
      }
    ],
    examples: [
      { command: `${COMMAND} page kit:guides-theming`, description: "Read a page." },
      { command: `${COMMAND} page kit:guides-theming --json`, description: "With its headings, as JSON." }
    ],
    run: async ({ args, options, io, log, isJson }): Promise<void> => {
      const config = await configOf(options.config);
      const params = new URLSearchParams({ id: args.id, view: options.view ?? "" });
      const body = await askCatalogue(config, options.url, "page", params, log);
      if (!isPageDocument(body)) throw new ScriptError("The catalogue's answer has an unexpected shape");
      printAnswer(pageText(body), body, body.problems, { io, log, isJson });
    }
  })
});
