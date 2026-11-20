/**
 * the npmPackage deploy CI job (run by catci: `catci publish npm`):
 * derives version + dist-tag from the pipeline trigger, stamps the
 * version into the package's package.json and runs `npm publish`.
 */
import { spawn } from "child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { uploadGithubReleaseAsset } from "./githubReleaseAsset";
import type { NpmPublishContext } from "./npmPublishPlan";
import { computeNpmPublishPlan, slugifyRef } from "./npmPublishPlan";

export const DEFAULT_NPM_REGISTRY = "https://registry.npmjs.org/";

export type NpmPublishJobOptions = {
  dir: string;
  envType: string;
  access?: string;
  registry?: string;
  distTag?: string;
  /** also attach the packed tarball to the github release of the tag */
  releaseAsset?: boolean;
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
 * writes the auth .npmrc and returns its absolute path. It is passed to
 * npm as userconfig: in a workspace monorepo npm resolves its project
 * prefix to the workspace ROOT, so a package-local .npmrc would be
 * silently ignored (ENEEDAUTH). npm expands `${NPM_TOKEN}` from the job
 * environment at run time and never includes .npmrc in the tarball.
 */
const writeNpmrc = async (dir: string, registry: string) => {
  const registryHost = registry.replace(/^https?:/, "").replace(/\/?$/, "/");
  const npmrcPath = resolve(dir, ".npmrc");
  await writeFile(
    npmrcPath,

    `${registryHost}:_authToken=\${NPM_TOKEN}\n`,
  );
  return npmrcPath;
};

/**
 * whether the CI job can mint an OIDC token for npm trusted publishing.
 * github actions exposes these two only when the job declares
 * `permissions: id-token: write` (catladder sets it via the job's
 * `idToken` flag).
 */
const hasOidcCredentials = () =>
  !!process.env.ACTIONS_ID_TOKEN_REQUEST_URL &&
  !!process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

const runNpm = (
  command: string,
  dir: string,
  npmrcPath: string | undefined,
  args: string[],
) =>
  new Promise<void>((resolvePromise, reject) => {
    const child = spawn("npm", [command, ...args], {
      cwd: dir,
      stdio: "inherit",
      env: {
        ...process.env,
        ...(npmrcPath ? { NPM_CONFIG_USERCONFIG: npmrcPath } : {}),
      },
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolvePromise()
        : reject(new Error(`npm ${command} exited with ${code}`)),
    );
  });

/**
 * packs the package and attaches the tarball to the github release of
 * the tag, so the version stays installable from github
 * (`<pm> add <asset url>`) independently of the registry.
 */
const attachTarballToGithubRelease = async (dir: string, tag: string) => {
  const env = process.env;
  const token = env.CL_JOB_TOKEN || env.GITHUB_TOKEN;
  if (!token || !env.GITHUB_REPOSITORY) {
    throw new Error(
      "releaseAsset needs the job token and GITHUB_REPOSITORY, but they are not set",
    );
  }
  const packDir = await mkdtemp(join(tmpdir(), "catladder-npm-pack-"));
  try {
    await runNpm("pack", dir, undefined, [
      "--pack-destination",
      packDir,
      "--workspaces=false",
    ]);
    const tarball = (await readdir(packDir)).find((f) => f.endsWith(".tgz"));
    if (!tarball) {
      throw new Error("npm pack did not produce a tarball");
    }
    const url = await uploadGithubReleaseAsset({
      apiUrl: env.GITHUB_API_URL || "https://api.github.com",
      repository: env.GITHUB_REPOSITORY,
      tag,
      token,
      name: tarball,
      content: await readFile(join(packDir, tarball)),
    });
    console.log(`attached ${tarball} to the github release ${tag}: ${url}`);
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
};

export const npmPublishJob = async (options: NpmPublishJobOptions) => {
  const oidc = hasOidcCredentials();
  if (!oidc && !process.env.NPM_TOKEN) {
    throw new Error(
      "NPM_TOKEN is not set — configure it as a catladder secret for this component, or publish from a workflow registered as a trusted publisher on npm",
    );
  }
  const registry = options.registry ?? DEFAULT_NPM_REGISTRY;
  const ciContext = readCiContext(options);
  const plan = computeNpmPublishPlan({
    envType: options.envType,
    distTagOverride: options.distTag,
    ...ciContext,
  });

  const name = await setPackageVersion(options.dir, plan.version);

  // the release asset is independent of the registry: attach it first,
  // so it exists even when the publish fails, and report its own
  // failure only after the publish had its chance
  let releaseAssetError: unknown;
  if (
    options.releaseAsset &&
    ciContext.ciTag &&
    process.env.GITHUB_ACTIONS === "true"
  ) {
    try {
      await attachTarballToGithubRelease(options.dir, ciContext.ciTag);
    } catch (error) {
      releaseAssetError = error;
      console.error(
        `could not attach the tarball to the github release: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
  // with OIDC available npm mints its own short-lived credentials, and
  // an .npmrc referencing an unset ${NPM_TOKEN} would only get in the
  // way. A token, when present, still wins as the fallback.
  const npmrcPath =
    oidc && !process.env.NPM_TOKEN
      ? undefined
      : await writeNpmrc(options.dir, registry);

  console.log(
    `publishing ${name}@${plan.version} (dist-tag ${plan.distTag}) to ${registry}${
      npmrcPath ? "" : " via trusted publishing (OIDC)"
    }`,
  );
  await runNpm("publish", options.dir, npmrcPath, [
    "--tag",
    plan.distTag,
    "--access",
    options.access ?? "public",
    "--registry",
    registry,
    // publish exactly this package, not the workspace set npm may
    // otherwise derive from the monorepo root
    "--workspaces=false",
  ]);
  console.log(`published ${name}@${plan.version} 🚀`);
  if (releaseAssetError) {
    throw releaseAssetError;
  }
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
  const releaseAsset = options["release-asset"];
  if (!dir || !envType) return null;
  if (releaseAsset !== undefined && !["true", "false"].includes(releaseAsset))
    return null;
  return {
    dir,
    envType,
    access,
    registry,
    distTag,
    ...(releaseAsset === "true" ? { releaseAsset: true } : {}),
  };
};
