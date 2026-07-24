import { isNil } from "lodash-es";
import { escapeForDotEnv } from "@catladder/bash";
import { ALL_BUILD_VARIABLES } from "../../context/getBuildInfoVariables";
import type { ComponentContext } from "../../types";
import { collapseableSection } from "../../utils/gitlab";

/**
 * writes a .env file in the components folder
 * @param context
 * @returns
 */
export const writeDotEnv = (context: ComponentContext) => {
  const envVars = context.environment.envVars;

  // make key=value and sanitize multiline
  const keyValueString = Object.entries(envVars)
    // filter out null and undefined values
    .filter(([, value]) => !isNil(value))
    // filter out build variables, since they may interfer with caching like turbo
    // build variables are rarely used anyway and we may treat them differently in the future
    .filter(([key]) => !ALL_BUILD_VARIABLES.includes(key))

    .map(([key, value]) => `${key}=${escapeForDotEnv(value)}`)
    .join("\n");

  return collapseableSection(
    "write-dotenv-" + context.name,
    "write dot env for " + context.name,
  )([
    `cat <<EOF > ${context.build.dir}/.env
${keyValueString}
EOF`,
  ]);
};

export const componentContextNeedsBuildTimeDotEnv = (
  context: ComponentContext,
) => {
  return (context.componentConfig.dotEnv ?? true) === true; // don't build when set to `local`
};
