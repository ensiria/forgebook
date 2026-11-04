/**
 * A story that fetches, its API mocked with MSW: `parameters.msw` as Storybook's addon writes it.
 *
 * @module
 */
import { delay, HttpResponse, http } from "msw";
import { type ReactNode, useEffect, useState } from "react";

/** Shows what an invented API answers. */
const Greeting = (): ReactNode => {
  const [text, setText] = useState("Loading");
  useEffect(() => {
    void fetch("/api/greeting")
      .then((response) => (response.ok ? response.json() : { text: "No answer" }))
      .then((body: { readonly text: string }) => setText(body.text));
  }, []);
  return <p data-testid="greeting">{text}</p>;
};

export default { title: "Fetching/Mocked", component: Greeting };

/** The API's answer, mocked. */
export const Answered = {
  parameters: {
    msw: { handlers: [http.get("/api/greeting", () => HttpResponse.json({ text: "Hello from a mock" }))] }
  }
};

/** The same, as a record of lists. */
export const AnsweredByName = {
  parameters: {
    msw: {
      handlers: { greeting: [http.get("/api/greeting", () => HttpResponse.json({ text: "Named mock" }))] }
    }
  }
};

/** Its request never answered: the story stays usable, and can be mounted again. */
export const Held = {
  parameters: { msw: { handlers: [http.get("/api/greeting", () => delay("infinite"))] } }
};

/** With no mock: the request goes to the network, and nothing of MSW loads. */
export const Unmocked = {};
