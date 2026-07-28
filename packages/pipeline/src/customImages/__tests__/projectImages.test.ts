import { describe, it, expect, afterAll } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { JobImagesPlan } from "../jobImagesPlan";
import { isProjectImageRef } from "../projectImages";

const FIXTURES_DIR = join(__dirname, "__project-fixtures__");

function setupFixture(name: string, files: Record<string, string>): string {
  const dir = join(FIXTURES_DIR, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(dir, path);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content);
  }
  return dir;
}

afterAll(() => {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

describe("isProjectImageRef", () => {
  it("matches a project image ref", () => {
    expect(isProjectImageRef({ image: "java-build" })).toBe(true);
  });

  it("does not match concrete images or catladder refs", () => {
    expect(isProjectImageRef("node:22")).toBe(false);
    expect(isProjectImageRef({ name: "node:22" })).toBe(false);
    expect(isProjectImageRef({ catladderImage: "jobs-default" })).toBe(false);
    expect(isProjectImageRef(undefined)).toBe(false);
  });
});

describe("JobImagesPlan project images", () => {
  it("resolves a project image ref to a content-hashed url in job-images/", () => {
    const dir = setupFixture("resolve", { Dockerfile: "FROM node:22\n" });
    const plan = new JobImagesPlan("gitlab", { "my-image": { dir } });

    const resolved = plan.resolve({ image: "my-image" });

    expect(resolved.image).toMatch(/\/job-images\/my-image:[0-9a-f]{12}$/);
    expect(resolved.fromRepoRegistry).toBe(true);
    expect(resolved.need).toMatchObject({
      job: "🐳 image my-image",
      optional: true,
      global: true,
    });
  });

  it("throws on an unknown image name, listing the declared ones", () => {
    const dir = setupFixture("unknown", { Dockerfile: "FROM node:22\n" });
    const plan = new JobImagesPlan("gitlab", { declared: { dir } });

    expect(() => plan.resolve({ image: "nope" })).toThrowError(
      /unknown job image "nope".*declared/,
    );
  });

  it("throws a hint when no images are declared at all", () => {
    const plan = new JobImagesPlan("gitlab");

    expect(() => plan.resolve({ image: "nope" })).toThrowError(
      /no images are declared in config.images/,
    );
  });

  it("emits one build job per used image, watching the dir and catladder.ts", () => {
    const dir = setupFixture("ensure", { Dockerfile: "FROM node:22\n" });
    const plan = new JobImagesPlan("gitlab", {
      used: { dir },
      unused: { dir },
    });

    plan.resolve({ image: "used" });
    const jobs = plan.getEnsureJobs();

    expect(jobs).toHaveLength(1);
    const [job] = jobs;
    expect(job.name).toBe("🐳 image used");
    expect(job.stage).toBe("setup");
    expect(job.rules).toEqual([{ changes: [`${dir}/**/*`, "catladder.ts"] }]);
  });

  it("watches hashExtraPaths and passes buildArgs to the docker build", () => {
    const dir = setupFixture("args", {
      Dockerfile: "ARG JAVA_VERSION\nFROM eclipse-temurin:${JAVA_VERSION}\n",
    });
    const extraFile = join(FIXTURES_DIR, "pom.xml");
    writeFileSync(extraFile, "<project/>");

    const plan = new JobImagesPlan("gitlab", {
      "java-build": {
        dir,
        hashExtraPaths: [extraFile],
        buildArgs: { JAVA_VERSION: "21" },
      },
    });

    plan.resolve({ image: "java-build" });
    const [job] = plan.getEnsureJobs();

    expect(job.rules).toEqual([
      { changes: [`${dir}/**/*`, extraFile, "catladder.ts"] },
    ]);
    const script = (job.script ?? []).join("\n");
    expect(script).toContain(`--build-arg 'JAVA_VERSION=21'`);
    expect(script).toContain(`-f ${dir}/Dockerfile ${dir}`);
  });

  it("changes the image tag when buildArgs change", () => {
    const dir = setupFixture("tagargs", {
      Dockerfile: "ARG V\nFROM node:${V}\n",
    });
    const resolveWithArgs = (v: string) =>
      new JobImagesPlan("gitlab", {
        img: { dir, buildArgs: { V: v } },
      }).resolve({ image: "img" });

    expect(resolveWithArgs("20").image).not.toBe(resolveWithArgs("22").image);
  });

  it("uses the ghcr expression prefix on github", () => {
    const dir = setupFixture("github", { Dockerfile: "FROM node:22\n" });
    const plan = new JobImagesPlan("github", { "my-image": { dir } });

    const resolved = plan.resolve({ image: "my-image" });

    expect(resolved.image).toMatch(
      /^ghcr\.io\/\$\{\{ github\.repository \}\}\/job-images\/my-image:/,
    );
  });

  it("does not materialize project image dirs into generated files", () => {
    const dir = setupFixture("materialize", { Dockerfile: "FROM node:22\n" });
    const plan = new JobImagesPlan("gitlab", { "my-image": { dir } });

    plan.resolve({ image: "my-image" });

    expect(plan.getGeneratedFiles()).toEqual([]);
  });
});
