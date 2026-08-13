import clsx from "clsx";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import CodeBlock from "@theme/CodeBlock";
import HomepageFeatures from "@site/src/components/HomepageFeatures";
import Heading from "@theme/Heading";

import styles from "./index.module.css";

const EXAMPLE_CONFIG = `// catladder.ts
import type { Config } from "@catladder/cli";

const config = {
  appName: "my-app",
  customerName: "acme",
  pipelines: { github: true }, // and/or gitlab — both at once during a migration
  releases: { when: "auto", method: "changesets" },
  components: {
    www: {
      dir: "apps/www",
      build: { type: "node" },
      deploy: { type: "google-cloudrun", projectId: "my-project", region: "europe-west6" },
      env: { review: {}, dev: {}, prod: {} },
    },
  },
} satisfies Config;

export default config;`;

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <img
          className={styles.heroLogo}
          src={useBaseUrl("img/cat_ladder_logo.svg")}
          alt=""
          width={277}
          height={221}
        />
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <p className={styles.heroText}>
          Catladder turns a single typed config into complete, committed
          pipelines for <strong>GitLab CI and GitHub Actions</strong>: build,
          test, review apps per merge request, cloud deployments, post-deploy
          verification and releases. Change the config, regenerate, commit.
          Never hand-edit CI YAML again.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting_started"
          >
            Get started
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            to="/docs/examples/"
          >
            Config examples
          </Link>
        </div>
      </div>
    </header>
  );
}

function HomepageExample() {
  return (
    <section className={styles.example}>
      <div className="container">
        <div className="row">
          <div className="col col--8 col--offset-2">
            <CodeBlock language="ts">{EXAMPLE_CONFIG}</CodeBlock>
            <p className={styles.exampleCaption}>
              <code>yarn catenv</code> generates everything from it — and the
              generated files are checked in, so every pipeline change is a
              reviewable diff.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout description="Catladder generates GitLab CI and GitHub Actions pipelines — builds, review apps, cloud deployments and releases — from one typed TypeScript config.">
      <HomepageHeader />
      <main>
        <HomepageExample />
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
