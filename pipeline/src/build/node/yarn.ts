import { Context } from "../../types";

export const getYarnInstallCommand = (
  context: Context,
  options?: {
    prodOnly?: boolean;
    noScripts?: boolean;
  }
) => {
  if (context.packageManagerInfo?.isClassic) {
    return `yarn install --frozen-lockfile ${
      options?.prodOnly ? "--production" : ""
    } ${options?.noScripts ? "--ignore-scripts" : ""}`;
  }
  // is modern

  // yarn >= 4 ships with build in plugins, see https://github.com/yarnpkg/berry/pull/4253
  // trying to import those fail on this version
  const doesNotShipWithBuiltInPlugins = ["2", "3"].some((v) =>
    context.packageManagerInfo?.version.startsWith(v)
  );
  return options?.prodOnly
    ? `${options?.noScripts ? "YARN_ENABLE_SCRIPTS=false " : ""}${
        doesNotShipWithBuiltInPlugins
          ? "yarn plugin import workspace-tools && "
          : " "
      }yarn workspaces focus --production` // needs yarn plugin import workspace-tools
    : `${
        options?.noScripts ? "YARN_ENABLE_SCRIPTS=false " : ""
      }yarn install --immutable`;
};

export const ensureNodeVersion = (context: Context) => [
  "if [ -f ./.nvmrc ]; then source /root/.nvm/nvm.sh && nvm install <<< .nvmrc; fi",
];

export const getYarnInstall = (context: Context) => [
  ...ensureNodeVersion(context),
  getYarnInstallCommand(context),
];
