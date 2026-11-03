/**
 * The site's search: a form that goes to the search page with the words as `?q=`, the words searched shown.
 *
 * @module
 */
"use client";

import Form from "next/form";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

/** The search. */
export const SearchBox = (): ReactNode => {
  const query = useSearchParams().get("q");
  return (
    <Form action="/search" className="flex flex-col gap-2">
      <label className="flex gap-2">
        <span>Search</span>
        <input name="q" defaultValue={query ?? ""} className="rounded border border-slate-300 px-2" />
      </label>
      <button type="submit" className="self-start rounded bg-harbour px-3 py-1 text-white">
        Go
      </button>
      {query === null ? null : <p role="status">Results for “{query}”</p>}
    </Form>
  );
};
