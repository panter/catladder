import { BashExpression } from "@catladder/bash";
import type {
  ComponentContextWithBuild,
  PackageManagerInfoBase,
  PackageManagerInfoComponent,
} from "../../types";
import type { AuditLevel } from "../types";
import { type Context } from "../../types";
import { ensureArray } from "../../utils";
import { collapseableSection } from "../../utils/gitlab";

const YARN_INSTALL_CLASSIC = `yarn install --frozen-lockfile`;

const YARN_BERRY_PROD_INSTALL = `yarn workspaces focus --production`;
// FIXME: check why and when rebuild is needed
const YARN_BERRY_PROD_REBUILD = `yarn rebuild`;

const getYarnInstallCommand = (
  packageManagerInfo: PackageManagerInfoBase & { type: "yarn" },
) => {
  if (packageManagerInfo.isClassic) {
    return YARN_INSTALL_CLASSIC;
  }
  // inline builds make debugging easier as it prints it out in the logs, instead of writing it in temp files
  return `yarn install --immutable --inline-builds`;
};

const isInWorkspace = (
  context: Context,
  packageManagerInfo: PackageManagerInfoBase | PackageManagerInfoComponent,
) =>
  context.type === "workspace" ||
  ("componentIsInWorkspace" in packageManagerInfo &&
    packageManagerInfo.componentIsInWorkspace);

/**
 * make sure pnpm is available (job images ship it, older/custom images
 * fall back to corepack or a pinned global install)
 */
const getEnsurePnpmCommand = (version: string) =>
  `if ! command -v pnpm &> /dev/null; then corepack enable pnpm 2>/dev/null || npm install -g pnpm@${version}; fi`;

/**
 * pnpm jobs use pnpm's own (global, per-runner) store location. There
 * used to be a `--store-dir` pointing at a project-local
 * `.pnpm-store`, so CI could cache it — that cache is gone (see
 * getYarnCache), and keeping the store inside the repo only meant it
 * landed in docker build contexts.
 */
const getPnpmInstallCommands = (
  packageManagerInfo: PackageManagerInfoBase & { type: "pnpm" },
) => [
  getEnsurePnpmCommand(packageManagerInfo.version),
  `pnpm install --frozen-lockfile`,
];

export const DEFAULT_AUDIT_LEVEL: AuditLevel = "critical";

/**
 * default `audit` job command per package manager, failing on advisories
 * of `level` and above. Exhaustive on the package-manager type and throws
 * for anything unsupported, so adding a new package manager surfaces every
 * place that needs a command here.
 */
export const getDefaultAuditCommand = (
  packageManagerInfo: PackageManagerInfoBase,
  level: AuditLevel = DEFAULT_AUDIT_LEVEL,
): string => {
  switch (packageManagerInfo.type) {
    case "pnpm":
      return `pnpm audit --prod --audit-level ${level}`;
    case "yarn":
      return packageManagerInfo.isClassic
        ? // classic walks the whole tree; --groups limits it to production
          `yarn audit --level ${level} --groups dependencies`
        : // yarn 2+ audits only the CURRENT workspace's DIRECT dependencies
          // by default — in a monorepo that is the root manifest, which
          // usually has no production dependencies at all, so the job passed
          // without checking anything. --all covers every workspace,
          // --recursive the transitive dependencies (what `pnpm audit` and
          // `yarn audit` classic do on their own).
          `yarn npm audit --environment production --severity ${level} --all --recursive`;
    default:
      throw new Error(
        `no audit command implemented for package manager "${(packageManagerInfo as { type: string }).type}"`,
      );
  }
};

export const ensureNodeVersion = (context: Context) =>
  collapseableSection(
    "nodeinstall",
    "Ensure node version",
  )([
    // github actions overrides HOME in container jobs, so also look
    // for nvm where the catladder images install it (/root/.nvm)
    'if [ -f "$HOME/.nvm/nvm.sh" ]; then source "$HOME/.nvm/nvm.sh"; elif [ -f /root/.nvm/nvm.sh ]; then export NVM_DIR=/root/.nvm; source /root/.nvm/nvm.sh; fi',
    "if command -v nvm &> /dev/null && [ -f ./.nvmrc ]; then nvm install; fi",
  ]);

export const getPackageManagerInstall = async (
  context: Context,
  options?: {
    noCustomPostInstall: boolean;
  },
) => {
  const packageManagerInfo = await context.packageManagerInfo;
  const postInstall =
    context.type !== "workspace" &&
    context.build.type !== "disabled" &&
    "postInstall" in context.build.config
      ? context.build.config.postInstall
      : null;
  const installSection =
    packageManagerInfo.type === "pnpm"
      ? collapseableSection(
          "pnpminstall",
          "pnpm install",
        )(getPnpmInstallCommands(packageManagerInfo))
      : collapseableSection(
          "yarninstall",
          "Yarn install",
        )([getYarnInstallCommand(packageManagerInfo)]);
  return [
    ...ensureNodeVersion(context),
    ...installSection,
    ...(postInstall && !options?.noCustomPostInstall
      ? collapseableSection(
          "postinstall",
          "Custom post install",
        )(ensureArray(postInstall))
      : []),
  ];
};

const DOCKER_COPY_FILES = `COPY --chown=node:node $APP_DIR .`;

const getPnpmDockerAppCopyAndBuildScript = (
  packageManagerInfo: PackageManagerInfoComponent & { type: "pnpm" },
) => {
  // the prod install downloads from the registry: nothing is copied
  // into the image to link from (see createNodeDockerJobDefinition).
  // The store it fills is scratch space outside /app, dropped in the
  // same layer so the packages ship once — node_modules holds
  // hardlinks, so removing the store keeps the files alive
  const storeDir = "/tmp/pnpm-store";
  // in a workspace, only install the component (and its workspace
  // dependencies) — the pnpm equivalent of `yarn workspaces focus`.
  // npm package names are shell-safe unquoted (the whole script is
  // embedded in a double-quoted bash export, so inner quotes would nest)
  const filter =
    packageManagerInfo.componentIsInWorkspace &&
    packageManagerInfo.currentWorkspace
      ? ` --filter ${packageManagerInfo.currentWorkspace.name}...`
      : "";
  return new BashExpression(
    `
${DOCKER_COPY_FILES}
RUN command -v pnpm >/dev/null 2>&1 || npm install -g pnpm@${packageManagerInfo.version}
RUN pnpm install --prod --frozen-lockfile --store-dir ${storeDir}${filter} && rm -rf ${storeDir}
    `.trim(),
  );
};

export const getDockerAppCopyAndBuildScript = async (
  context: ComponentContextWithBuild,
) => {
  const packageManagerInfo = await context.packageManagerInfo;
  if (packageManagerInfo.type === "pnpm") {
    return getPnpmDockerAppCopyAndBuildScript(packageManagerInfo);
  }
  if (packageManagerInfo.isClassic) {
    return new BashExpression(
      `
RUN ${YARN_INSTALL_CLASSIC} --production --ignore-scripts
${DOCKER_COPY_FILES}
RUN ${YARN_INSTALL_CLASSIC} --production
    `.trim(),
    );
  }

  const yarnRebuildEnabledDefault =
    context.build.type === "fromWorkspace"
      ? (context.build.workspaceBuildConfig.dockerDefaults
          ?.yarnRebuildEnabled ?? true)
      : true;

  const yarnRebuildEnabled =
    "docker" in context.build.config &&
    context.build.config.docker &&
    "yarnRebuildEnabled" in context.build.config.docker
      ? (context.build.config.docker.yarnRebuildEnabled ??
        yarnRebuildEnabledDefault)
      : yarnRebuildEnabledDefault;

  // yarn >= 4 ships with build in plugins, see https://github.com/yarnpkg/berry/pull/4253
  // trying to import those fail on this version
  const doesNotShipWithBuiltInPlugins = ["2", "3"].some((v) =>
    packageManagerInfo.version.startsWith(v),
  );
  const maybeAddWorkspaceToolsCommand = doesNotShipWithBuiltInPlugins
    ? "RUN yarn plugin import workspace-tools"
    : "";

  // copy first everything and then install
  // rebuild first does not work as it will run postinstall and that might require files in the app
  return new BashExpression(
    `
    ENV YARN_ENABLE_INLINE_BUILDS=1
${DOCKER_COPY_FILES}
${maybeAddWorkspaceToolsCommand}
RUN ${YARN_BERRY_PROD_INSTALL}
${yarnRebuildEnabled ? `RUN ${YARN_BERRY_PROD_REBUILD}` : ""}

    `.trim(),
  );
};
