/**
 * the npmPackage deploy CI job (run by catci: `catci publish npm`):
 * derives version + dist-tag from the pipeline trigger, stamps the
 * version into the package's package.json and runs `npm publish`.
 */
import { spawn } from "child_process";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { NpmPublishContext } from "./npmPublishPlan";
import { computeNpmPublishPlan, slugifyRef } from "./npmPublishPlan";

export const DEFAULT_NPM_REGISTRY = "https://registry.npmjs.org/";

export type NpmPublishJobOptions = {
  dir: string;
  envType: string;
  access?: string;
  registry?: string;
  distTag?: string;
};

/**
 * reads the trigger context from the CI provider's predefined
 * variables (gitlab or github)
 */
const readCiContext = (
  options: NpmPublishJobOptions,
): Omit<NpmPublishContext, "envType" | "distTagOverride"> => {
  const env = process.env;
  if (env.GITLAB_CI === "true") {
    return {
      ciTag: env.CI_COMMIT_TAG || null,
      refSlug: env.CI_COMMIT_REF_SLUG ?? "",
      shortSha: env.CI_COMMIT_SHORT_SHA ?? "",
    };
  }
  if (env.GITHUB_ACTIONS === "true") {
    return {
      ciTag:
        env.GITHUB_REF_TYPE === "tag" ? (env.GITHUB_REF_NAME ?? null) : null,
      // GITHUB_HEAD_REF is the source branch on pull_request events
      refSlug: slugifyRef(env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || ""),
      shortSha: (env.GITHUB_SHA ?? "").slice(0, 8),
    };
  }
  throw new Error(
    `publish npm for "${options.dir}" must run in a gitlab or github CI job (no CI provider detected)`,
  );
};

const setPackageVersion = async (dir: string, version: string) => {
  const packageJsonPath = join(dir, "package.json");
  const pkg = JSON.parse(await readFile(packageJsonPath, "utf-8"));
  pkg.version = version;
  await writeFile(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");
  return pkg.name as string;
};

/**
 * writes the package-local .npmrc for token auth. npm expands
 * `${NPM_TOKEN}` from the job environment at run time, and never
 * includes .npmrc in the published tarball.
 */
const writeNpmrc = async (dir: string, registry: string) => {
  const registryHost = registry.replace(/^https?:/, "").replace(/\/?$/, "/");
  await writeFile(
    join(dir, ".npmrc"),
    [
      `registry=${registry}`,

      `${registryHost}:_authToken=\${NPM_TOKEN}`,
      "",
    ].join("\n"),
  );
};

const npmPublish = (dir: string, args: string[]) =>
  new Promise<void>((resolvePromise, reject) => {
    const child = spawn("npm", ["publish", ...args], {
      cwd: dir,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolvePromise()
        : reject(new Error(`npm publish exited with ${code}`)),
    );
  });

export const npmPublishJob = async (options: NpmPublishJobOptions) => {
  if (!process.env.NPM_TOKEN) {
    throw new Error(
      "NPM_TOKEN is not set — configure it as a catladder secret for this component",
    );
  }
  const registry = options.registry ?? DEFAULT_NPM_REGISTRY;
  const plan = computeNpmPublishPlan({
    envType: options.envType,
    distTagOverride: options.distTag,
    ...readCiContext(options),
  });

  const name = await setPackageVersion(options.dir, plan.version);
  await writeNpmrc(options.dir, registry);

  console.log(
    `publishing ${name}@${plan.version} (dist-tag ${plan.distTag}) to ${registry}`,
  );
  await npmPublish(options.dir, [
    "--tag",
    plan.distTag,
    "--access",
    options.access ?? "public",
    "--no-git-tag-version",
  ]);
  console.log(`published ${name}@${plan.version} 🚀`);
};

/** parses the `catci publish npm --flag value ...` argument list */
export const parseNpmPublishArgs = (
  args: string[],
): NpmPublishJobOptions | null => {
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (!flag?.startsWith("--") || value === undefined) return null;
    options[flag.slice(2)] = value;
  }
  const { dir, access, registry } = options;
  const envType = options["env-type"];
  const distTag = options["dist-tag"];
  if (!dir || !envType) return null;
  return { dir, envType, access, registry, distTag };
};
