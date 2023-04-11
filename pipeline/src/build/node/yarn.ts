import type { Context } from "../../types";

const YARN_INSTALL_CLASSIC = `yarn install --frozen-lockfile`;

// FIXME: check why and when rebuild is needed
const YARN_BERRY_PROD_REBUILD = `yarn workspaces focus --production && yarn rebuild`;

const getYarnInstallCommand = (context: Context) => {
  if (context.packageManagerInfo?.isClassic) {
    return YARN_INSTALL_CLASSIC;
  }

  return `yarn install --immutable`;
};

export const ensureNodeVersion = (context: Context) => [
  "if [ -f ./.nvmrc ]; then source /root/.nvm/nvm.sh && nvm install <<< .nvmrc; fi",
];

export const getYarnInstall = (context: Context) => [
  ...ensureNodeVersion(context),
  getYarnInstallCommand(context),
];

const DOCKER_COPY_FILES = `COPY --chown=node:node $APP_DIR .`;

export const getDockerAppCopyAndBuildScript = (context: Context) => {
  if (context.packageManagerInfo?.isClassic) {
    return `
RUN ${YARN_INSTALL_CLASSIC} --production --ignore-scripts
${DOCKER_COPY_FILES}
RUN ${YARN_INSTALL_CLASSIC} --production 
    `.trim();
  }

  // yarn >= 4 ships with build in plugins, see https://github.com/yarnpkg/berry/pull/4253
  // trying to import those fail on this version
  const doesNotShipWithBuiltInPlugins = ["2", "3"].some((v) =>
    context.packageManagerInfo?.version.startsWith(v)
  );
  const maybeAddWorkspaceToolsCommand = doesNotShipWithBuiltInPlugins
    ? "RUN yarn plugin import workspace-tools"
    : "";

  // copy first everything and then install
  // rebuild first does not work as it will run postinstall and that might require files in the app
  return `
${DOCKER_COPY_FILES}
${maybeAddWorkspaceToolsCommand}
RUN ${YARN_BERRY_PROD_REBUILD}

    `.trim();
};
