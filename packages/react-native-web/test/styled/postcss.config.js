/**
 * A PostCSS configuration whose one plugin marks the style sheet, so the test sees it ran.
 *
 * @module
 */
export default {
  plugins: [
    {
      postcssPlugin: "mark",
      Once: (root, { Rule, Declaration }) => {
        root.append(
          new Rule({ selector: ".marked-by-postcss" }).append(
            new Declaration({ prop: "color", value: "red" })
          )
        );
      }
    }
  ]
};
