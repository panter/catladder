import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type {
  Options as PresetOptions,
  ThemeConfig as PresetThemeConfig,
} from "@docusaurus/preset-classic";
import simplePlantUML from "@akebifiky/remark-simple-plantuml";

const config: Config = {
  title: "CatLadder",
  tagline: "Your whole CI/CD pipeline, generated from one TypeScript file",
  favicon: "img/favicon.ico",
  // Set the production url of your site here
  url: "https://panter.github.io",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/catladder/",
  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "panter", // GitHub org
  projectName: "catladder", // GitHub repo
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: { defaultLocale: "en", locales: ["en"] },
  markdown: { mermaid: true },
  themes: ["@docusaurus/theme-mermaid"],

  plugins: [require.resolve("docusaurus-lunr-search")],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          remarkPlugins: [simplePlantUML],
          // generated pages (examples, agent skills) have no editable
          // source here — they are rendered from packages/pipeline/examples
          // and skills/ on every build
          editUrl: ({ docPath }) =>
            docPath.startsWith("examples/") ||
            docPath.startsWith("4_agents/skills/")
              ? undefined
              : `https://github.com/panter/catladder/tree/main/apps/docs/docs/${docPath}`,
        },
        // no blog: the docs are the site
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies PresetOptions,
    ],
  ],

  themeConfig: {
    image: "img/cat_ladder_logo.svg",
    navbar: {
      title: "CatLadder",
      logo: { alt: "CatLadder Logo", src: "img/logo.svg" },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Documentation",
        },
        {
          to: "/docs/getting_started",
          label: "Getting started",
          position: "left",
        },
        {
          href: "https://www.npmjs.com/package/@catladder/cli",
          label: "npm",
          position: "right",
        },
        {
          href: "https://github.com/panter/catladder",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Getting started", to: "/docs/getting_started" },
            { label: "Deploy types", to: "/docs/deploy/" },
            { label: "Releases", to: "/docs/releases" },
            { label: "Config examples", to: "/docs/examples/" },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/panter/catladder",
            },
            {
              label: "Issues",
              href: "https://github.com/panter/catladder/issues",
            },
            {
              label: "@catladder/cli on npm",
              href: "https://www.npmjs.com/package/@catladder/cli",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Catladder @ Panter - Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: [
        "bash",
        "dart",
        "diff",
        "docker",
        "git",
        "ini",
        "java",
        "json",
        "json5",
        "jsonp",
        "jsstacktrace",
        "log",
        "makefile",
        "mermaid",
        "nginx",
        "plant-uml",
        "ruby",
        "rust",
        "systemd",
        "toml",
        "typescript",
        "typoscript", // tsconfig
        "vim",
      ],
    },
  } satisfies PresetThemeConfig,
};

export default config;
