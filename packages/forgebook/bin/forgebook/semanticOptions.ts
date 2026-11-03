/**
 * The options that name the model `--semantic` asks, shared by `forgebook check` and `forgebook mcp`: read from the
 * environment, so a key stays out of the project's files and of the command line.
 *
 * @module
 */
import type { SemanticModel } from "../../src/storyCheck.ts";

/** The options. */
export const SEMANTIC_OPTIONS = {
  "semantic-url": {
    type: "string",
    env: "FORGEBOOK_SEMANTIC_URL",
    valueName: "address",
    description: "The OpenAI-compatible API --semantic asks."
  },
  "semantic-model": {
    type: "string",
    env: "FORGEBOOK_SEMANTIC_MODEL",
    valueName: "name",
    description: "The model --semantic asks."
  },
  "semantic-key": {
    type: "string",
    env: "FORGEBOOK_SEMANTIC_KEY",
    valueName: "key",
    description: "Its key, when it needs one: better in the environment than here."
  }
} as const;

/** What those options give a command. */
type SemanticOptions = {
  /** The API's address. */
  readonly "semantic-url"?: string | undefined;
  /** The model's name. */
  readonly "semantic-model"?: string | undefined;
  /** Its key. */
  readonly "semantic-key"?: string | undefined;
};

/**
 * The model the options name.
 *
 * @param options - the command's options.
 * @returns the model, or what to set.
 */
export const semanticModelOf = (options: SemanticOptions): SemanticModel | string => {
  const url = options["semantic-url"];
  const name = options["semantic-model"];
  const key = options["semantic-key"];
  if (url === undefined || name === undefined) {
    return "Set FORGEBOOK_SEMANTIC_URL (an OpenAI-compatible API) and FORGEBOOK_SEMANTIC_MODEL, with FORGEBOOK_SEMANTIC_KEY when it needs one";
  }
  return { url, name, ...(key === undefined ? {} : { key }) };
};
