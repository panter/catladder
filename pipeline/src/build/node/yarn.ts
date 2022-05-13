import { Context } from "../../types";

export const getYarnInstallCommand = (
  context: Context,
  options?: {
    prodOnly?: boolean;
    noScripts?: boolean;
  }
) =>
  context.packageManagerInfo?.isClassic
    ? `yarn install --frozen-lockfile ${
        options?.prodOnly ? "--production" : ""
      } ${options?.noScripts ? "--ignore-scripts" : ""}`
    : options?.prodOnly
    ? `${
        options?.noScripts ? "YARN_ENABLE_SCRIPTS=false " : ""
      }yarn plugin import workspace-tools && yarn workspaces focus --production` // needs yarn plugin import workspace-tools
    : `${
        options?.noScripts ? "YARN_ENABLE_SCRIPTS=false " : ""
      }yarn install --immutable`;

export const ensureNodeVersion = (context: Context) => [
  "if [ -f ./.nvmrc ]; then source /root/.nvm/nvm.sh && nvm install <<< .nvmrc; fi",
];

export const getYarnInstall = (context: Context) => [
  ...ensureNodeVersion(context),
  getYarnInstallCommand(context),
];
