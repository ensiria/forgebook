/**
 * The catalogue's preview: the app's style sheet and fonts around every story, as its root layout gives them.
 *
 * @module
 */
import "./app/globals.css";

import type { Preview } from "@forgebook/nextjs";

import { inter, mono } from "@/lib/fonts";

export default {
  decorators: [
    (Story) => (
      <div className={`${inter.variable} ${mono.variable} font-sans`}>
        <Story />
      </div>
    )
  ]
} satisfies Preview;
