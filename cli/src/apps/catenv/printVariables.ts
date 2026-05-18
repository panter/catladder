import type { CatenvContext, Config } from "@catladder/pipeline";
import { getEnvVarsResolved } from "../../config/getProjectConfig";
import type { Choice } from "./types";
import {
  getCurrentComponentAndEnvFromChoice,
  makeKeyValueString,
  sanitizeEnvVarName,
} from "./utils";

const getAllVariablesToPrint = async (config: Config, choice?: Choice) => {
  const { env, currentComponent } = await getCurrentComponentAndEnvFromChoice(
    config,
    choice,
  );

  if (currentComponent) {
    return await getEnvVarsResolved(null, env, currentComponent);
  } else {
    // when in a monorep and not in a subapp, merge all env vars.
    // this is not 100% correct, but better than not exporting any vars at all
    // so we also add prefixed variants
    return await Object.keys(config.components).reduce(
      async (acc, componentName) => {
        const subappvars = await getEnvVarsResolved(null, env, componentName);
        delete subappvars["_ALL_ENV_VAR_KEYS"];
        return {
          ...(await acc),
          ...subappvars,
          // also add prefixed variants in case
          ...Object.fromEntries(
            Object.entries(subappvars).map(([key, value]) => [
              `${sanitizeEnvVarName(componentName.toUpperCase())}_${key}`,
              value,
            ]),
          ),
        };
      },
      Promise.resolve({} as Record<string, string>),
    );
  }
};

export const printVariables = async (
  context: CatenvContext,
  choice?: Choice,
) => {
  const variables = await getAllVariablesToPrint(context.config, choice);

  console.log(makeExportKeyValuestring(variables));
};

const makeExportKeyValuestring = (variables: Record<string, string>) =>
  makeKeyValueString(variables, {
    keyPrefix: "export ",
    escapeOptions: { quoteMode: "always" },
  });
