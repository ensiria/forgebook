/**
 * Forgebook's renderer for React Native in the browser, whole: the frame's drawing (`nativeFrameRenderer.ts`) and
 * React's server render, for the generated server tests, which draws no root: a server has no frame to lay out.
 *
 * @remarks
 * The frame page imports `nativeFrameRenderer.ts` alone, so React's server renderer never reaches it.
 *
 * @module
 */
import { reactRenderer } from "@forgebook/react/renderer";
import type { StoryRenderer } from "forgebook/renderer";

import { nativeFrameRenderer } from "./nativeFrameRenderer.ts";

/** React Native, through react-native-web, as the frame draws with it and the server tests render with it. */
export const nativeRenderer: StoryRenderer = {
  ...nativeFrameRenderer,
  renderToString: reactRenderer.renderToString
};
