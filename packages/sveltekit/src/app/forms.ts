/**
 * `$app/forms` in a catalogue: a form with `use:enhance` is submitted to no server. The submission is listed among the
 * story's events, the story's `forms.result` (a success by default) is what the action answers, and the page's `form`,
 * status or error follow it as SvelteKit's `applyAction` sets them.
 *
 * @module
 */
import { actionResultOf, errorOf, type KitActionResult } from "../kitParameters.ts";
import { currentStore, type KitStore } from "../kitStore.ts";

/** What `use:enhance`'s function receives as the form is submitted. */
export type SubmitInput = {
  /** The action's address (`?/login`, from the page). */
  readonly action: URL;
  /** The form's values. */
  readonly formData: FormData;
  /** The form. */
  readonly formElement: HTMLFormElement;
  /** Aborts the submission. */
  readonly controller: AbortController;
  /** The button that submitted the form, or `null`. */
  readonly submitter: HTMLElement | null;
  /** Stops the submission. */
  readonly cancel: () => void;
};

/** What the function `use:enhance`'s function returns receives, once the action answered. */
export type SubmitResultInput = Omit<SubmitInput, "controller" | "submitter" | "cancel"> & {
  /** What the action answered. */
  readonly result: KitActionResult;
  /**
   * Does what SvelteKit does without a function: after a success, resets the form and loads the page's data again;
   * applies the result.
   */
  readonly update: (options?: UpdateOptions) => Promise<void>;
};

/** What `update` may leave out: the reset (`reset: false`), the new load (`invalidateAll` or `refreshAll: false`). */
export type UpdateOptions = {
  /** Whether a success resets the form; `true` by default. */
  readonly reset?: boolean;
  /** Whether a success loads the page's data again (SvelteKit 2's name); `true` by default. */
  readonly invalidateAll?: boolean;
  /** Whether a success loads the page's data again (SvelteKit 3's name); `true` by default. */
  readonly refreshAll?: boolean;
};

/** `use:enhance`'s function. */
export type SubmitFunction = (input: SubmitInput) => unknown;

/**
 * Applies an action's result to the story's page.
 *
 * @param store - the story's page.
 * @param result - the result.
 */
const applied = async (store: KitStore, result: KitActionResult): Promise<void> => {
  switch (result.type) {
    case "success":
    case "failure":
      store.setPage({ form: result.data ?? null, status: result.status });
      return;
    case "redirect":
      await store.navigate("goto", result.location);
      return;
    case "error":
      store.setPage({
        error: errorOf(result.error) ?? { message: String(result.error) },
        status: result.status ?? 500
      });
  }
};

/**
 * Applies an action's result to the page, as SvelteKit's does: a success or failure sets `page.form` and the status,
 * a redirect moves the page, an error sets `page.error`.
 *
 * @param result - the result.
 */
export const applyAction = async (result: KitActionResult): Promise<void> => {
  const store = currentStore();
  store.record("applyAction", [result]);
  await applied(store, result);
};

/**
 * An action's answer read from its text, as SvelteKit writes it: its data in JSON (SvelteKit writes it with
 * `devalue`, which a value JSON can write reads the same with).
 *
 * @param text - the answer's text.
 */
export const deserialize = (text: string): KitActionResult => {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return { type: "error", error: new Error("The answer is not an action's result") };
  const fields = Object.fromEntries(Object.entries(parsed));
  const { data } = fields;
  return actionResultOf({ ...fields, data: typeof data === "string" ? JSON.parse(data) : data });
};

/**
 * A form's values, as the catalogue lists them: files by their name.
 *
 * @param formData - the values.
 */
const listedValues = (formData: FormData): Record<string, string> =>
  Object.fromEntries(
    [...formData].map(([name, value]) => [name, typeof value === "string" ? value : value.name])
  );

/**
 * Submits a form to no server: what `use:enhance` does in a story.
 *
 * @param form - the form.
 * @param submit - the function called as it is submitted; what it returns is called with the result.
 * @returns what removes the behaviour.
 */
export const enhance = (form: HTMLFormElement, submit?: SubmitFunction): { readonly destroy: () => void } => {
  const onSubmit = async (event: SubmitEvent): Promise<void> => {
    const store = currentStore();
    // SvelteKit enhances a POST form only: another is the browser's (the story's frame keeps it, as for a link)
    const method = (event.submitter?.getAttribute("formmethod") ?? form.method).toLowerCase();
    if (method !== "post") return;
    event.preventDefault();
    // only a button of this form adds its value to the form's: FormData refuses any other
    const { submitter: sent } = event;
    const submitter =
      (sent instanceof HTMLButtonElement || sent instanceof HTMLInputElement) && sent.form === form
        ? sent
        : null;
    const target = submitter?.getAttribute("formaction") ?? form.getAttribute("action") ?? "";
    const action = new URL(target, store.page().url);
    const formData = new FormData(form, submitter);
    store.record("enhance", [`${action.pathname}${action.search}`, listedValues(formData)]);
    store.kit.forms.enhance?.();
    let isCancelled = false;
    const controller = new AbortController();
    const after: unknown = await submit?.({
      action,
      formData,
      formElement: form,
      controller,
      submitter,
      cancel: (): void => {
        isCancelled = true;
      }
    });
    if (isCancelled) return;
    const result = store.kit.forms.result ?? { type: "success", status: 200 };
    const update = async (options: UpdateOptions = {}): Promise<void> => {
      if (result.type === "success") {
        if (options.reset !== false) form.reset();
        // a success loads the page's data again, as SvelteKit's does, unless told not to
        if (options.invalidateAll !== false && options.refreshAll !== false) await store.reload();
      }
      await applied(store, result);
    };
    if (typeof after === "function") await after({ action, formData, formElement: form, result, update });
    else await update();
  };
  const listener = (event: SubmitEvent): void => {
    void onSubmit(event);
  };
  form.addEventListener("submit", listener);
  return {
    destroy: (): void => form.removeEventListener("submit", listener)
  };
};
