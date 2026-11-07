/**
 * A prop chosen among the catalogue's design tokens (`control: { type: "token", of: "color" }`, or `@token color` in its
 * TSDoc): a search over the tokens it asks for, each with its value and, for a colour, its swatch.
 *
 * @remarks
 * The story receives a plain text, so a link holds it and a reader without the tokens still sees it. What it writes is
 * the token's value unless the control gives a `format` (`var(--{name})`), which keeps a catalogue's themes working.
 * Without tokens to offer it stays a text field: a prop never loses its control to a missing file.
 *
 * @module
 */
import { type ChangeEvent, type ReactNode, useEffect, useState } from "react";

import type { TokenRequest } from "../../argTypes.ts";
import { isShellTokens, type ShellToken } from "../audiencePage.ts";
import type { Loaded } from "../useLoaded.ts";
import { EDITOR_STRINGS } from "./editorStrings.ts";
import { type SearchOption, SearchSelect } from "./SearchSelect.tsx";

/**
 * The tokens a request offers: of that type, or with that part in their name.
 *
 * @param tokens - the catalogue's tokens.
 * @param of - the type or the part of a name.
 */
export const tokensOf = (tokens: readonly ShellToken[], of: string): readonly ShellToken[] =>
  tokens.filter(
    (token) => token.deprecated === undefined && (token.type === of || token.name.split(".").includes(of))
  );

/**
 * What a token gives the story.
 *
 * @param token - the token.
 * @param format - the control's `format`; the token's value by default.
 */
export const tokenText = (token: ShellToken, format: string | undefined): string =>
  (format ?? "{value}")
    .replaceAll("{name}", token.name.replaceAll(".", "-"))
    .replaceAll("{value}", token.value);

/** The token editor's props. */
export type TokenEditorProps = {
  /** The field's name. */
  readonly label: string;
  /** The element that describes it. */
  readonly describedBy: string;
  /** Which tokens it offers. */
  readonly tokens: TokenRequest;
  /** The chosen text. */
  readonly value: string | undefined;
  /** Loads the catalogue's tokens; none when it has none. */
  readonly loadTokens: (() => Promise<unknown>) | undefined;
  /** Called with the chosen text; none for no value. */
  readonly onChange: (value: string | undefined) => void;
};

/**
 * The token editor.
 *
 * @param props - the field's name, the tokens it offers, and its value.
 */
export const TokenEditor = ({
  label,
  describedBy,
  tokens,
  value,
  loadTokens,
  onChange
}: TokenEditorProps): ReactNode => {
  const [loaded, setLoaded] = useState<Loaded<readonly ShellToken[]>>(
    loadTokens === undefined ? { status: "ready", value: [] } : { status: "loading" }
  );
  useEffect(() => {
    if (loadTokens === undefined) return;
    let isCurrent = true;
    loadTokens().then(
      (answer) => {
        if (!isCurrent) return;
        setLoaded(
          isShellTokens(answer)
            ? { status: "ready", value: answer.tokens }
            : { status: "error", message: "The tokens have an unexpected shape" }
        );
      },
      (error: unknown) => {
        if (isCurrent) {
          setLoaded({ status: "error", message: error instanceof Error ? error.message : String(error) });
        }
      }
    );
    return (): void => {
      isCurrent = false;
    };
  }, [loadTokens]);
  if (loaded.status === "loading")
    return <p className="forgebook-value-note">{EDITOR_STRINGS.tokensLoading}</p>;
  const offered = loaded.status === "ready" ? tokensOf(loaded.value, tokens.of) : [];
  if (offered.length === 0) {
    return (
      <>
        <p className="forgebook-value-note">
          {loaded.status === "error"
            ? EDITOR_STRINGS.tokensFailed(loaded.message)
            : EDITOR_STRINGS.tokensNone(tokens.of)}
        </p>
        <input
          type="text"
          aria-label={label}
          aria-describedby={describedBy}
          value={value ?? ""}
          onChange={(event: ChangeEvent<HTMLInputElement>): void => onChange(event.target.value)}
        />
      </>
    );
  }
  const options = offered.map(
    (token): SearchOption => ({
      value: tokenText(token, tokens.format),
      label: token.name,
      hint: token.value,
      ...(token.type === "color" ? { swatch: token.value } : {})
    })
  );
  return (
    <SearchSelect
      label={label}
      describedBy={describedBy}
      options={options}
      value={value}
      onChange={onChange}
    />
  );
};
