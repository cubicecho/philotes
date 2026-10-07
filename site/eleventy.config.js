// Eleventy config for the philotes site.
//
// Deployed to https://cubicecho.github.io/philotes/, so everything is served
// under the /philotes/ path prefix. Use the `| url` filter on every internal
// link and asset — a bare "/css/cubesite.css" 404s on Pages and works in dev,
// which is the worst way for it to break.

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/css": "css" });
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // Pages runs Jekyll over the artifact unless told not to; a leading-underscore
  // directory (like _includes output, if any) would vanish without this.
  eleventyConfig.addPassthroughCopy({ "src/nojekyll": ".nojekyll" });

  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  eleventyConfig.setServerOptions({ port: 3000 });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    pathPrefix: "/philotes/",
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    templateFormats: ["njk", "md"],
  };
}
