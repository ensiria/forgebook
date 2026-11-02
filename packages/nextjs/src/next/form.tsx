/**
 * `next/form` in a catalogue: a form whose action is a path moves the story's route to it with the fields as search
 * params, as Next.js's `Form` navigates; a form whose action is a function is React's own form.
 *
 * @module
 */
import type { FormHTMLAttributes, ReactNode, Ref, SubmitEvent } from "react";

import { valuesOfSearch } from "../route.ts";
import { currentStore } from "../routeStore.ts";

/** The props of `Form`: Next.js's, and the form's own. */
export type FormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  /** A path to go to with the fields as search params, or a function (a server action). */
  readonly action: string | ((formData: FormData) => void | Promise<void>);
  /** Whether it replaces the current entry of the history instead of adding one. */
  readonly replace?: boolean;
  /** Whether the page scrolls to the top: no effect in a story. */
  readonly scroll?: boolean;
  /** Whether the route is prefetched: no effect in a story. */
  readonly prefetch?: boolean;
  /** The form. */
  readonly ref?: Ref<HTMLFormElement>;
};

/**
 * The search params a form's fields make: its texts only, as a browser's GET form sends them.
 *
 * @param form - the form.
 * @param submitter - the button that sent it, whose name and value count too.
 */
const searchOfForm = (form: HTMLFormElement, submitter: HTMLElement | null): string => {
  const search = new URLSearchParams();
  for (const [name, value] of new FormData(form, submitter))
    if (typeof value === "string") search.append(name, value);
  return search.toString();
};

/**
 * Next.js's `Form`.
 *
 * @param props - its props.
 */
const Form = (props: FormProps): ReactNode => {
  const { action, replace, scroll: _scroll, prefetch: _prefetch, onSubmit, ref, ...form } = props;
  if (typeof action !== "string") return <form {...form} ref={ref} action={action} onSubmit={onSubmit} />;
  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    onSubmit?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    const { submitter } = event;
    currentStore().navigate(replace === true ? "replace" : "push", {
      // a GET form's fields replace the search its action holds, as the browser's and Next.js's do
      pathname: action.split("?")[0] ?? action,
      query: valuesOfSearch(searchOfForm(event.currentTarget, submitter))
    });
  };
  return <form {...form} ref={ref} action={action} onSubmit={submit} />;
};

export default Form;
