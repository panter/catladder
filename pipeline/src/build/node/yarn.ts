import { Context } from "../../types";

export const getYarnInstall = (context: Context) => [
  "if [ -f ./.nvmrc ]; then source /root/.nvm/nvm.sh && nvm install <<< .nvmrc; fi",
  context.yarnInfo?.isClassic
    ? "yarn install --frozen-lockfile"
    : "yarn install --immutable",
];
