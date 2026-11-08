/**
 * Small projects as `forgebook init` finds them, one per framework: a `package.json`, the entry its template writes and
 * a style sheet, so a test can write one in a folder and run the command on it.
 *
 * @module
 */

/** A project's files, by path from its folder. */
export type ProjectFiles = Readonly<Record<string, string>>;

/** A `package.json` declaring packages at a version Forgebook takes. */
const manifest = (name: string, dependencies: Readonly<Record<string, string>>): string =>
  `${JSON.stringify({ name, private: true, type: "module", dependencies }, null, 2)}\n`;

/** A page that starts a script, as Vite's templates write it. */
const page = (script: string): string =>
  `<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="${script}"></script></body></html>\n`;

/** What a project on Vite shares: its page, and a style sheet. */
const viteFiles = (script: string): ProjectFiles => ({
  "index.html": page(script),
  "src/index.css": "body { margin: 0; }\n"
});

/** One project per framework, by the name `--framework` takes. */
export const NEW_PROJECTS: Readonly<Record<string, ProjectFiles>> = {
  react: {
    "package.json": manifest("new-react", { react: "^19.0.0", "react-dom": "^19.0.0", vite: "^8.3.4" }),
    ...viteFiles("/src/main.tsx"),
    "src/main.tsx":
      'import "./index.css";\nimport { createRoot } from "react-dom/client";\ncreateRoot(document.getElementById("root")).render(<App />);\n',
    "src/Badge.tsx": [
      "export type BadgeProps = { readonly label: string };",
      "/** A label. */",
      "export const Badge = ({ label }: BadgeProps) => <span>{label}</span>;",
      ""
    ].join("\n")
  },
  vue: {
    "package.json": manifest("new-vue", { vue: "^3.5.0", vite: "^8.3.4" }),
    ...viteFiles("/src/main.ts"),
    "src/main.ts":
      'import { createApp } from "vue";\nimport "./index.css";\nimport App from "./App.vue";\ncreateApp(App).use(router).use(createPinia()).mount("#root");\n',
    "src/Badge.vue": [
      '<script setup lang="ts">',
      "/** The text. */",
      "defineProps<{ label: string }>();",
      "</script>",
      "<template><span>{{ label }}</span></template>",
      ""
    ].join("\n")
  },
  svelte: {
    "package.json": manifest("new-svelte", { svelte: "^5.46.4", vite: "^8.3.4" }),
    ...viteFiles("/src/main.ts"),
    "src/main.ts": 'import "./index.css";\nimport { mount } from "svelte";\nmount(App, { target: root });\n'
  },
  solid: {
    "package.json": manifest("new-solid", { "solid-js": "^1.9.0", vite: "^8.3.4" }),
    ...viteFiles("/src/index.tsx"),
    "src/index.tsx":
      'import "./index.css";\nimport { render } from "solid-js/web";\nrender(() => <Router><App /></Router>, document.getElementById("root"));\n'
  },
  preact: {
    "package.json": manifest("new-preact", { preact: "^10.19.0", vite: "^8.3.4" }),
    ...viteFiles("/src/main.tsx"),
    "src/main.tsx":
      'import "./index.css";\nimport { render } from "preact";\nrender(<App />, document.getElementById("root"));\n'
  },
  "web-components": {
    "package.json": manifest("new-lit", { lit: "^3.2.0", vite: "^8.3.4" }),
    "index.html":
      '<!doctype html><html><head><link rel="stylesheet" href="/src/index.css"></head><body><my-element></my-element></body></html>\n',
    "src/index.css": "body { margin: 0; }\n"
  },
  angular: {
    "package.json": manifest("new-angular", {
      "@angular/build": "^21.0.0",
      "@angular/common": "^21.0.0",
      "@angular/compiler": "^21.0.0",
      "@angular/compiler-cli": "^21.0.0",
      "@angular/core": "^21.0.0",
      "@angular/platform-browser": "^21.0.0"
    }),
    "angular.json": JSON.stringify({
      projects: {
        app: {
          architect: {
            build: { options: { styles: ["src/styles.css", { input: "src/lazy.css", inject: false }] } }
          }
        }
      }
    }),
    "src/styles.css": "body { margin: 0; }\n",
    "src/main.ts":
      "bootstrapApplication(App, { providers: [provideRouter(routes), provideZoneChangeDetection()] });\n"
  },
  nextjs: {
    "package.json": manifest("new-next", { next: "^16.0.0", react: "^19.0.0", "react-dom": "^19.0.0" }),
    "app/globals.css": "body { margin: 0; }\n",
    "app/layout.tsx": [
      'import { Inter } from "next/font/google";',
      'import "./globals.css";',
      "export default ({ children }) => (",
      '  <html><body><ThemeProvider><Header />{children}</ThemeProvider><div id="modals" /></body></html>',
      ");",
      ""
    ].join("\n"),
    "components/Hero.tsx": "export const Hero = () => <h1>Hello</h1>;\n"
  },
  nuxt: {
    "package.json": manifest("new-nuxt", { nuxt: "^4.0.0", vue: "^3.5.0", "vue-router": "^4.5.0" }),
    "nuxt.config.ts": 'export default defineNuxtConfig({ css: ["~/assets/main.css"] });\n',
    "app/app.vue": "<template><NuxtPage /></template>\n"
  },
  sveltekit: {
    "package.json": manifest("new-kit", { "@sveltejs/kit": "^2.0.0", svelte: "^5.46.4", vite: "^8.3.4" }),
    "src/app.html": '<!doctype html><html><body><div id="kit-root">%sveltekit.body%</div></body></html>\n',
    "src/app.css": "body { margin: 0; }\n",
    "src/routes/+layout.svelte": '<script>\n  import "../app.css";\n</script>\n<slot />\n'
  },
  "react-native-web": {
    "package.json": manifest("new-expo", {
      expo: "^54.0.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
      "react-native": "^0.81.0",
      "react-native-web": "^0.21.0",
      "react-native-reanimated": "^4.0.0",
      nativewind: "^4.2.0",
      vite: "^8.3.4"
    }),
    "babel.config.js": "module.exports = {};\n",
    "global.css": "@tailwind base;\n",
    "app/_layout.tsx": 'import "../global.css";\nexport default () => <Stack />;\n'
  }
};
