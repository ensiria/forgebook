/**
 * The Storybook fixture's Storybook configuration, as a project that moves to Forgebook has it: read by
 * `forgebook init --from storybook` in the importer's tests, never run by Storybook here.
 *
 * @module
 */
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: { name: "@storybook/react-vite", options: {} }
};

export default config;
