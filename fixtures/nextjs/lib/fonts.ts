/**
 * The site's fonts, loaded as a Next.js app loads them: Inter from Google, the code font from a file of the app.
 *
 * @module
 */
import { Inter } from "next/font/google";
import localFont from "next/font/local";

/** The text font, as the `--font-sans` variable. */
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  fallback: ["system-ui", "sans-serif"]
});

/** The code font, as the `--font-mono` variable. */
export const mono = localFont({
  src: "../app/fonts/JetBrainsMono-latin.woff2",
  variable: "--font-mono",
  weight: "400",
  fallback: ["ui-monospace", "monospace"]
});
