/**
 * The Angular fixture's preview: a wrapper around every story, written as Storybook's Angular decorators write one, so
 * a story shows it is inside the catalogue's own wrapper, in the language the toolbar chose.
 *
 * @module
 */
import { componentWrapperDecorator, type Preview } from "@forgebook/angular";

export default {
  decorators: [
    componentWrapperDecorator(
      (story) => `<div data-testid="preview" [attr.data-lang]="previewLang">${story}</div>`,
      (context) => ({ previewLang: context.globals["lang"] ?? "en" })
    )
  ]
} satisfies Preview;
