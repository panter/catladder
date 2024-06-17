import { BashExpression } from "../../bash/BashExpression";
import type { BuildContext, ComponentContext } from "../../types";
import { ensureArray } from "../../utils";
import { collapseableSection } from "../../utils/gitlab";

const YARN_INSTALL_CLASSIC = `yarn install --frozen-lockfile`;

// FIXME: check why and when rebuild is needed
const YARN_BERRY_PROD_REBUILD = `yarn workspaces focus --production && yarn rebuild`;

const getYarnInstallCommand = (context: BuildContext) => {
  if (context.packageManagerInfo?.isClassic) {
    return YARN_INSTALL_CLASSIC;
  }

  return `yarn install --immutable`;
};

export const ensureNodeVersion = (context: BuildContext) =>
  collapseableSection(
    "nodeinstall",
    "Ensure node version",
  )([
    "if [ -f ~/.nvm/nvm.sh ];  then source ~/.nvm/nvm.sh; fi",
    "if command -v nvm &> /dev/null && [ -f ./.nvmrc ]; then nvm install; fi",
  ]);

export const getYarnInstall = (
  context: BuildContext,
  options?: {
    noCustomPostInstall: boolean;
  },
) => {
  const postInstall =
    "postInstall" in context.config ? context.config.postInstall : null;
  return [
    ...ensureNodeVersion(context),
    ...collapseableSection(
      "yarninstall",
      "Yarn install",
    )([getYarnInstallCommand(context)]),
    ...(postInstall && !options?.noCustomPostInstall
      ? collapseableSection(
          "postinstall",
          "Custom post install",
        )(ensureArray(postInstall) ?? [])
      : []),
  ];
};

const DOCKER_COPY_FILES = `COPY --chown=node:node $APP_DIR .`;

export const getDockerAppCopyAndBuildScript = (context: BuildContext) => {
  if (context.packageManagerInfo?.isClassic) {
    return new BashExpression(
      `
RUN ${YARN_INSTALL_CLASSIC} --production --ignore-scripts
${DOCKER_COPY_FILES}
RUN ${YARN_INSTALL_CLASSIC} --production 
    `.trim(),
    );
  }

  // yarn >= 4 ships with build in plugins, see https://github.com/yarnpkg/berry/pull/4253
  // trying to import those fail on this version
  const doesNotShipWithBuiltInPlugins = ["2", "3"].some((v) =>
    context.packageManagerInfo?.version.startsWith(v),
  );
  const maybeAddWorkspaceToolsCommand = doesNotShipWithBuiltInPlugins
    ? "RUN yarn plugin import workspace-tools"
    : "";

  // copy first everything and then install
  // rebuild first does not work as it will run postinstall and that might require files in the app
  return new BashExpression(
    `
${DOCKER_COPY_FILES}
${maybeAddWorkspaceToolsCommand}
RUN ${YARN_BERRY_PROD_REBUILD}

    `.trim(),
  );
};
