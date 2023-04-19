import type { Config } from "@catladder/pipeline";
import { getEnvVarsResolved } from "../../config/getProjectConfig";
import type { Choice, Variables } from "./types";
import {
  getCurrentComponentAndEnvFromChoice,
  makeKeyValueString,
  sanitizeEnvVarName,
} from "./utils";

const getAllVariablesToPrint = async (config: Config, choice?: Choice) => {
  const { env, currentComponent } = await getCurrentComponentAndEnvFromChoice(
    config,
    choice
  );

  let variables = {};
  if (currentComponent) {
    variables = await getEnvVarsResolved(null, env, currentComponent);
  } else {
    // when in a monorep and not in a subapp, merge all env vars.
    // this is not 100% correct, but better than not exporting any vars at all
    // so we also add prefixed variants
    variables = await Object.keys(config.components).reduce(
      async (acc, componentName) => {
        const subappvars = await getEnvVarsResolved(null, env, componentName);
        return {
          ...(await acc),
          ...subappvars,
          // also add prefixed variants in case
          ...Object.fromEntries(
            Object.entries(subappvars).map(([key, value]) => [
              `${sanitizeEnvVarName(componentName.toUpperCase())}_${key}`,
              value,
            ])
          ),
        };
      },
      {}
    );
  }
  return variables;
};

export const printVariables = async (config: Config, choice?: Choice) => {
  const variables = await getAllVariablesToPrint(config, choice);

  console.log(makeExportKeyValuestring(variables));
};

const makeExportKeyValuestring = (variables: Variables) =>
  makeKeyValueString(variables, "export ");
