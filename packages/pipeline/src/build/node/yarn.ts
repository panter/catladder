import { BashExpression } from "@catladder/bash";
import type { ComponentContextWithBuild } from "../../types";
import { type Context } from "../../types";
import { ensureArray } from "../../utils";
import { collapseableSection } from "../../utils/gitlab";

const YARN_INSTALL_CLASSIC = `yarn install --frozen-lockfile`;

const YARN_BERRY_PROD_INSTALL = `yarn workspaces focus --production`;
// FIXME: check why and when rebuild is needed
const YARN_BERRY_PROD_REBUILD = `yarn rebuild`;

const getYarnInstallCommand = async (context: Context) => {
  const packageManagerInfo = await context.packageManagerInfo;
  if (packageManagerInfo.isClassic) {
    return YARN_INSTALL_CLASSIC;
  }
  // inline builds make debugging easier as it prints it out in the logs, instead of writing it in temp files
  return `yarn install --immutable --inline-builds`;
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

export const getYarnInstall = async (
  context: Context,
  options?: {
    noCustomPostInstall: boolean;
  },
) => {
  const postInstall =
    context.type !== "workspace" &&
    context.build.type !== "disabled" &&
    "postInstall" in context.build.config
      ? context.build.config.postInstall
      : null;
  return [
    ...ensureNodeVersion(context),
    ...collapseableSection(
      "yarninstall",
      "Yarn install",
    )([await getYarnInstallCommand(context)]),
    ...(postInstall && !options?.noCustomPostInstall
      ? collapseableSection(
          "postinstall",
          "Custom post install",
        )(ensureArray(postInstall))
      : []),
  ];
};

const DOCKER_COPY_FILES = `COPY --chown=node:node $APP_DIR .`;

export const getDockerAppCopyAndBuildScript = async (
  context: ComponentContextWithBuild,
) => {
  const packageManagerInfo = await context.packageManagerInfo;
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
