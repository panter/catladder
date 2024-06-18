import { isNil } from "lodash";
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
    .map(
      ([key, value]) => `${key}=${value?.toString().replaceAll("\n", "\\n")}`,
    )
    .join("\n");

  return collapseableSection(
    "write-dotenv-" + context.name,
    "write dot env",
  )([
    `cat <<EOF > ${context.build.dir}/.env
${keyValueString}
EOF`,
  ]);
};

export const componentContextNeedsBuildTimeDotEnv = (
  context: ComponentContext,
) => {
  return context.componentConfig.dotEnv === true; // don't build when set to `local`
};
