import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type {
  Options as PresetOptions,
  ThemeConfig as PresetThemeConfig,
} from "@docusaurus/preset-classic";
import simplePlantUML from "@akebifiky/remark-simple-plantuml";

const config: Config = {
  title: "CatLadder",
  tagline: "Documentation",
  favicon: "img/favicon.ico",
  // Set the production url of your site here
  url: "https://catladder.git.panter.biz",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/catladder",
  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "catladder", // Usually your GitHub org/user name.
  projectName: "catladder", // Usually your repo name.
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: { defaultLocale: "en", locales: ["en"] },
  markdown: { mermaid: true },
  themes: ["@docusaurus/theme-mermaid"],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          remarkPlugins: [simplePlantUML],
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          // editUrl:
          //   'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        },
        // blog: {
        //   showReadingTime: true,
        //   // Please change this to your repo.
        //   // Remove this to remove the "edit this page" links.
        //   // editUrl:
        //   // 'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        // },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies PresetOptions,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: "img/docusaurus-social-card.jpg",
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
        // {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: "https://git.panter.ch/catladder/catladder",
          label: "GitLab",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [{ label: "Getting Started", to: "/docs/getting_started" }],
        },
        {
          title: "More",
          items: [
            {
              label: "GitLab",
              href: "https://git.panter.ch/catladder/catladder",
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
