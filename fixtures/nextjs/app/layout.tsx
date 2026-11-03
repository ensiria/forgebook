/**
 * The app's root layout: its fonts and its style sheet around every page.
 *
 * @module
 */
import "./globals.css";

import type { ReactNode } from "react";

import { inter, mono } from "@/lib/fonts";

/** The page's title and description. */
export const metadata = { title: "Harbour", description: "A small harbour's notes." };

/**
 * The root layout.
 *
 * @param props - the page.
 */
const RootLayout = ({ children }: { readonly children: ReactNode }): ReactNode => (
  <html lang="en" className={`${inter.variable} ${mono.variable}`}>
    <body className="font-sans">{children}</body>
  </html>
);

export default RootLayout;
