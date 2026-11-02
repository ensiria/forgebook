/**
 * The Network tab: the handlers of a story, and the requests it made, each answered by a handler or by the network.
 *
 * @module
 */
import type { PluginTabContext } from "forgebook/plugin";
import { type PluginViewProps, reactView } from "forgebook/plugin-react";
import type { ReactNode } from "react";

import "./networkTab.css";
import { networkReportOf } from "./networkReport.ts";

/**
 * The tab.
 *
 * @param props - what the tab is told.
 */
const NetworkTab = ({ context }: PluginViewProps<PluginTabContext>): ReactNode => {
  const { text } = context;
  const report = networkReportOf(context.report);
  if (report === undefined) {
    return <p className="forgebook-tab-note">{text("none", "This story has no handlers running.")}</p>;
  }
  const mocked = text("mocked", "Mocked");
  const network = text("network", "Network");
  return (
    <div className="forgebook-network">
      <section className="forgebook-network__part">
        <h3 className="forgebook-network__heading">{text("handlers", "Handlers")}</h3>
        <ul className="forgebook-network__list">
          {report.handlers.map((handler, place) => (
            // two handlers may read the same, and the list never reorders
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <li key={place} className="forgebook-network__row">
              <code>{handler.label}</code>
            </li>
          ))}
        </ul>
      </section>
      <section className="forgebook-network__part">
        <h3 className="forgebook-network__heading">{text("requests", "Requests")}</h3>
        {report.requests.length === 0 ? (
          <p className="forgebook-tab-note">{text("noRequests", "No request yet.")}</p>
        ) : (
          <table className="forgebook-network__table">
            <thead>
              <tr>
                <th scope="col">{text("method", "Method")}</th>
                <th scope="col">{text("address", "Address")}</th>
                <th scope="col">{text("status", "Status")}</th>
                <th scope="col">{text("answeredBy", "Answered by")}</th>
              </tr>
            </thead>
            <tbody>
              {report.requests.map((request, place) => (
                // the same request may come twice, and the log has no id of its own
                // biome-ignore lint/suspicious/noArrayIndexKey: see above
                <tr key={place}>
                  <td>{request.method}</td>
                  <td className="forgebook-network__address">
                    <code>{request.url}</code>
                  </td>
                  <td>{request.status}</td>
                  <td>{request.isMocked ? mocked : network}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

/** The tab, as Forgebook mounts it. */
export const view = reactView(NetworkTab);
