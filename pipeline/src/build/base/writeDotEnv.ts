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
    .map(([key, value]) => `${key}=${value.replaceAll("\n", "\\n")}`)
    .join("\n");

  return [
    `cat <<EOF > ${context.componentConfig.dir}/.env
${keyValueString}
EOF`,
  ];
};
