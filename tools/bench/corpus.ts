/**
 * The corpus the benchmark runs on: a generated component library, and its files in the form each tool's users write.
 *
 * @remarks
 * Generated, so its size is a parameter, and deterministic (no clock, no random numbers), so two machines measure the
 * same files. Each component has typed, documented props, a style sheet, a shared helper and a neighbour it renders,
 * so a story pulls a small graph as a real one does. Plain CSS: Sass is an optional peer of Forgebook, and would weigh
 * on the tool that installs it. The stories are the only difference between the two forms: `csf3` is what Forgebook and
 * Storybook users write, `functions` is the only form Ladle draws.
 *
 * @module
 */

/** How many shared images the components use. */
const IMAGES = 10;

/** One story in every this many has a play function. */
const PLAY_EVERY = 10;

/** The tones a story cycles through. */
const TONES = ["neutral", "success", "danger", "warning"] as const;

/** The groups the sidebar shows, so it is a tree and not a flat list. */
const GROUPS = ["Actions", "Forms", "Layout", "Navigation", "Overlays", "Feedback", "Data", "Media"] as const;

/** A story of the corpus. */
export type CorpusStory = {
  /** The export's name. */
  readonly name: string;
  /** The text it shows, what a measurement waits for. */
  readonly label: string;
  /** Its tone. */
  readonly tone: (typeof TONES)[number];
  /** Whether it has a play function. */
  readonly hasPlay: boolean;
};

/** A component of the corpus. */
export type CorpusComponent = {
  /** Its name, also its files' name. */
  readonly name: string;
  /** Its group in the sidebar. */
  readonly group: string;
  /** The image it shows. */
  readonly image: number;
  /** Its stories. */
  readonly stories: readonly CorpusStory[];
};

/** A generated library. */
export type Corpus = {
  /** Its components, in order. */
  readonly components: readonly CorpusComponent[];
};

/** How big a corpus is. */
export type CorpusSize = {
  /** How many components. */
  readonly components: number;
  /** How many stories over all of them. */
  readonly stories: number;
};

/** The form stories are written in. */
export type StoryForm = "csf3" | "functions";

/**
 * Builds a corpus.
 *
 * @param size - how many components and stories.
 * @throws when a component would have no story.
 */
export const buildCorpus = ({ components, stories }: CorpusSize): Corpus => {
  if (stories < components) throw new Error("every component needs at least one story");
  const perComponent = Math.floor(stories / components);
  const extra = stories % components;
  let index = 0;
  return {
    components: Array.from({ length: components }, (_, position) => ({
      name: `Widget${position}`,
      group: GROUPS[position % GROUPS.length] ?? "Actions",
      image: position % IMAGES,
      stories: Array.from({ length: perComponent + (position < extra ? 1 : 0) }, (_, storyIndex) => {
        index += 1;
        return {
          name: `Story${storyIndex}`,
          label: `Widget${position} story ${storyIndex}`,
          tone: TONES[storyIndex % TONES.length] ?? "neutral",
          hasPlay: storyIndex > 0 && index % PLAY_EVERY === 0
        };
      })
    }))
  };
};

/**
 * A component's source.
 *
 * @param component - the component.
 * @param neighbour - the component it renders, none for the first.
 */
const componentFile = (component: CorpusComponent, neighbour: CorpusComponent | undefined): string => {
  const { name, image } = component;
  const nested =
    neighbour === undefined ? "" : `\n      {isNested ? <${neighbour.name} label="nested" /> : null}`;
  return `import image from "../assets/image${image}.svg";
import { classes } from "../shared/classes";
${neighbour === undefined ? "" : `import { ${neighbour.name} } from "./${neighbour.name}";\n`}import "./${name}.css";

/** The text that shows which build of the component is on screen. */
const BUILD = "build 0";

/** The props of ${name}. */
export type ${name}Props = {
  /** The text it shows. */
  readonly label: string;
  /** How it reads. @defaultValue "neutral" */
  readonly tone?: "neutral" | "success" | "danger" | "warning";
  /** Whether it shows its image. @defaultValue true */
  readonly hasImage?: boolean;
  /** Whether it renders its neighbour. @defaultValue false */
  readonly isNested?: boolean;
  /** Called when it is pressed. */
  readonly onPress?: () => void;
};

/** A component of the generated library. */
export const ${name} = ({ label, tone = "neutral", hasImage = true, isNested = false, onPress }: ${name}Props) => (
  <section className={classes("${name.toLowerCase()}", \`${name.toLowerCase()}--\${tone}\`)} data-bench="item">
    {hasImage ? <img alt="" height={32} src={image} width={32} /> : null}
    <button onClick={onPress} type="button">
      <span data-bench="label">{label}</span>
      <small data-bench="build">{BUILD}</small>
    </button>${nested}
  </section>
);
`;
};

/**
 * A component's style sheet.
 *
 * @param component - the component.
 */
const styleFile = ({ name }: CorpusComponent): string => {
  const block = name.toLowerCase();
  return `.${block} {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  color: var(--bench-text);
  background: var(--bench-surface);
}

${TONES.map((tone) => `.${block}--${tone} {\n  border: 1px solid var(--bench-${tone});\n}`).join("\n\n")}
`;
};

/** A story's args, as source. */
const argsSource = (story: CorpusStory): string =>
  `{ label: ${JSON.stringify(story.label)}, tone: ${JSON.stringify(story.tone)} }`;

/** A play function, as source: no import, so the two tools that run one pay the same. */
const PLAY_SOURCE = `async ({ canvasElement }) => {
    canvasElement.querySelector("button")?.focus();
  }`;

/**
 * A component's stories file.
 *
 * @param component - the component.
 * @param form - the form to write them in.
 */
const storiesFile = (component: CorpusComponent, form: StoryForm): string => {
  const { name, group } = component;
  const header = `import { ${name} } from "./${name}";\n\n`;
  if (form === "csf3") {
    const stories = component.stories.map((story) => {
      const play = story.hasPlay ? `,\n  play: ${PLAY_SOURCE}` : "";
      return `/** ${story.label}. */\nexport const ${story.name} = {\n  args: ${argsSource(story)}${play}\n};`;
    });
    return `${header}export default { title: "${group}/${name}", component: ${name} };\n\n${stories.join("\n\n")}\n`;
  }
  const stories = component.stories.map(
    (story) =>
      `/** ${story.label}. */\nexport const ${story.name} = (args) => <${name} {...args} />;\n` +
      `${story.name}.args = ${argsSource(story)};`
  );
  return `${header}export default { title: "${group}/${name}" };\n\n${stories.join("\n\n")}\n`;
};

/**
 * An image: an inline drawing, so nothing is downloaded and every tool pays the same.
 *
 * @param index - the image's number.
 */
const imageFile = (index: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="${6 + index}" fill="#e8501c"/></svg>\n`;

/** The shared theme: what the theme switch of each tool changes. */
const THEME_FILE = `:root {
  --bench-text: #1b1915;
  --bench-surface: #fbfaf8;
  --bench-neutral: #7a7369;
  --bench-success: #1e7a46;
  --bench-danger: #b4332b;
  --bench-warning: #9a6a00;
}

[data-theme="dark"] {
  --bench-text: #fbfaf8;
  --bench-surface: #1b1915;
}
`;

/** The helper every component imports. */
const CLASSES_FILE = `/** Joins class names. */
export const classes = (...names: readonly string[]): string => names.join(" ");
`;

/**
 * Every file of the generated library, by path from the project's root.
 *
 * @param corpus - the library.
 * @param form - the form its stories are written in.
 */
export const projectFiles = (corpus: Corpus, form: StoryForm): Readonly<Record<string, string>> => {
  const files: Record<string, string> = {
    "src/shared/theme.css": THEME_FILE,
    "src/shared/classes.ts": CLASSES_FILE
  };
  for (let image = 0; image < IMAGES; image += 1) {
    files[`src/assets/image${image}.svg`] = imageFile(image);
  }
  corpus.components.forEach((component, index) => {
    const path = `src/components/${component.name}`;
    files[`${path}.tsx`] = componentFile(component, corpus.components[index - 1]);
    files[`${path}.css`] = styleFile(component);
    files[`${path}.stories.tsx`] = storiesFile(component, form);
  });
  return files;
};
