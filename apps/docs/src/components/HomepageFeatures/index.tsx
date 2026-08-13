import Heading from "@theme/Heading";
import Link from "@docusaurus/Link";
import styles from "./styles.module.css";

type FeatureItem = {
  title: string;
  to: string;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Two CI backends, one config",
    to: "/docs/getting_started",
    description: (
      <>
        GitLab CI and GitHub Actions are generated from the same{" "}
        <code>catladder.ts</code>. Run both in parallel to migrate between them
        step by step.
      </>
    ),
  },
  {
    title: "Environments built in",
    to: "/docs/getting_started#environments",
    description: (
      <>
        A review app per merge request (stopped when it closes), a dev
        deployment on the main branch, stage and prod on tagged releases — and{" "}
        <code>.env</code> files for local development.
      </>
    ),
  },
  {
    title: "Deploy types, not deploy scripts",
    to: "/docs/deploy/",
    description: (
      <>
        Google Cloud Run (services, jobs, worker pools, Cloud SQL, schedules),
        Kubernetes, npm packages, GitLab/GitHub pages — or your own script.
      </>
    ),
  },
  {
    title: "Releases as a feature",
    to: "/docs/releases",
    description: (
      <>
        semantic-release or changesets, both gated on a security audit, with
        release queueing, a force-release escape hatch and a changeset check on
        every merge request.
      </>
    ),
  },
  {
    title: "Secrets with a source of truth",
    to: "/docs/environment_variables#managing-secrets",
    description: (
      <>
        A vault holds the values, CI backends only get mirrored copies, and the
        same declarations produce your local <code>.env</code> files.
      </>
    ),
  },
  {
    title: "A doctor for drift",
    to: "/docs/troubleshooting",
    description: (
      <>
        <code>catladder project doctor</code> compares the config against the
        infrastructure that actually exists — IAM, secrets, tokens, merge gating
        — and prints the command that heals each finding.
      </>
    ),
  },
];

function Feature({ title, description, to }: FeatureItem) {
  return (
    <div className="col col--4">
      <div className={styles.feature}>
        <Heading as="h3">
          <Link to={to}>{title}</Link>
        </Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props) => (
            <Feature key={props.title} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
