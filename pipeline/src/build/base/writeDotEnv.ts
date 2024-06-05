import { isNil } from "lodash";
import type { Context } from "../../types";

/**
 * writes a .env file in the components folder
 * @param context
 * @returns
 */
export const writeDotEnv = (context: Context) => {
  const envVars = context.environment.envVars;

  // make key=value and sanitize multiline
  const keyValueString = Object.entries(envVars)
    // filter out null and undefined values
    .filter(([, value]) => !isNil(value))
    .map(
      ([key, value]) => `${key}=${value?.toString().replaceAll("\n", "\\n")}`
    )
    .join("\n");

  return [
    `cat <<EOF > ${context.componentConfig.dir}/.env
${keyValueString}
EOF`,
  ];
};
