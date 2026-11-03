/**
 * A phone app's screen: a large title, a search field, grouped rows and a tab bar, light or dark with the catalogue's
 * theme. The fixture the device frames are shown on, since it fills a phone's screen as an app does.
 *
 * @module
 */
import "./appScreen.scss";

import type { ReactNode } from "react";

/** The app screen's props. */
export type AppScreenProps = {
  /** The screen's large title. */
  readonly title: string;
};

/** Invented rows, in two groups. */
const GROUPS: readonly (readonly { readonly label: string; readonly value: string }[])[] = [
  [
    { label: "Wi-Fi", value: "Home" },
    { label: "Bluetooth", value: "On" },
    { label: "Mobile data", value: "" }
  ],
  [
    { label: "Notifications", value: "" },
    { label: "Sounds", value: "" },
    { label: "Focus", value: "Off" },
    { label: "Screen time", value: "" }
  ]
];

/** The tab bar's tabs, the first chosen. */
const TABS: readonly string[] = ["Settings", "Search", "Profile"];

/**
 * The screen.
 *
 * @param props - its title.
 */
export const AppScreen = ({ title }: AppScreenProps): ReactNode => (
  <div className="app-screen">
    <header className="app-screen__head">
      <h1 className="app-screen__title">{title}</h1>
      <input className="app-screen__search" type="search" placeholder="Search" aria-label="Search" />
    </header>
    <main className="app-screen__body">
      {GROUPS.map((rows) => (
        <ul key={rows[0]?.label} className="app-screen__group">
          {rows.map((row) => (
            <li key={row.label} className="app-screen__row">
              <span>{row.label}</span>
              <span className="app-screen__value">{row.value}</span>
            </li>
          ))}
        </ul>
      ))}
    </main>
    <nav className="app-screen__tabs" aria-label="Sections">
      {TABS.map((tab, index) => (
        <button
          key={tab}
          type="button"
          className="app-screen__tab"
          aria-current={index === 0 ? "page" : undefined}
        >
          {tab}
        </button>
      ))}
    </nav>
  </div>
);
