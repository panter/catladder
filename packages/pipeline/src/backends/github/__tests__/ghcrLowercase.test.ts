import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { yamlStringifyOptions } from "../../../utils/writeFiles";
import { JobImagesPlan } from "../../../customImages/jobImagesPlan";
import type { Config } from "../../../types";
import { GithubBackend } from "../GithubBackend";
import { githubRegistryImageFromConfig } from "../registryImage";
import { GithubScriptFiles } from "../scriptFiles";

const config = {
  appName: "test-app",
  customerName: "pan",
  pipelines: { github: { repository: "FiulAG/Nautilus" } },
  images: {
    "db-tools": { dockerfile: ["FROM alpine:3.21"] },
  },
  components: {
    api: {
      dir: "api",
      build: {
        type: "node",
        test: { command: "yarn test:db", jobImage: { image: "db-tools" } },
      },
      deploy: {
        type: "kubernetes",
        cluster: {
          name: "some-cluster-name",
          region: "europe-west6",
          projectId: "some-project-id",
          type: "gcloud",
          domainCanonical: "panter.cloud",
        },
      },
    },
  },
} as unknown as Config;

/** every `ghcr.io/…` path in the text, up to the first whitespace */
const ghcrReferences = (text: string): string[] =>
  [...text.matchAll(/ghcr\.io\/\S+/g)].map(([match]) => match);

const generate = async () => {
  const scripts = new GithubScriptFiles();
  const images = new JobImagesPlan(
    "github",
    config.images,
    githubRegistryImageFromConfig(config),
  );
  const workflows = await new GithubBackend().createWorkflows(
    config,
    images,
    scripts,
  );
  return [
    stringify(workflows, yamlStringifyOptions),
    ...[...scripts.getGeneratedFiles(), ...images.getGeneratedFiles()].map(
      ({ content }) => content,
    ),
  ].join("\n");
};

describe("ghcr image paths of a mixed-case repository", () => {
  it("never emit an uppercase character", async () => {
    const generated = await generate();
    const references = ghcrReferences(generated);

    // guards against the assertion silently passing on empty output
    expect(references.length).toBeGreaterThan(0);
    expect(references.filter((ref) => /[A-Z]/.test(ref))).toEqual([]);
    // the actions context interpolates github's display casing, so it
    // must not survive anywhere for this repository
    expect(generated).not.toContain("ghcr.io/${{ github.repository }}");
  });

  it("cover the container image, the workflow env and the docker commands", async () => {
    const generated = await generate();

    // jobs.<id>.container.image — resolved before any step runs, which
    // is why a shell-side `tr A-Z a-z` could never have fixed this
    expect(generated).toMatch(
      /image: ghcr\.io\/fiulag\/nautilus\/catladder\/[\w-]+:\w+/,
    );
    // the workflow-level env every `run:` block consumes
    expect(generated).toMatch(/CL_REGISTRY_IMAGE: ghcr\.io\/fiulag\/nautilus/);
    // the ensure-image jobs
    expect(generated).toMatch(
      /docker manifest inspect ghcr\.io\/fiulag\/nautilus\//,
    );
    expect(generated).toMatch(/docker build -t ghcr\.io\/fiulag\/nautilus\//);
    expect(generated).toMatch(/docker push ghcr\.io\/fiulag\/nautilus\//);
    // project-declared job images live under job-images/
    expect(generated).toMatch(
      /ghcr\.io\/fiulag\/nautilus\/job-images\/db-tools:/,
    );
  });
});

describe("an all-lowercase repository", () => {
  it("keeps the portable actions expression", async () => {
    const scripts = new GithubScriptFiles();
    const lowercase = {
      ...config,
      pipelines: { github: { repository: "fiulag/nautilus" } },
    } as unknown as Config;
    const images = new JobImagesPlan(
      "github",
      lowercase.images,
      githubRegistryImageFromConfig(lowercase),
    );
    const workflows = await new GithubBackend().createWorkflows(
      lowercase,
      images,
      scripts,
    );

    expect(stringify(workflows, yamlStringifyOptions)).toContain(
      "ghcr.io/${{ github.repository }}",
    );
  });
});
