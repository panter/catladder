import type { UnspecifiedEnvVars } from "../types";
import { isNil } from "lodash";
import { bashEscape } from "./bashEscape";

export const getInjectVarsScript = (vars?: UnspecifiedEnvVars) => {
  if (!vars) return [];
  // filter out null and undefined values
  return Object.entries(vars)
    .filter(([, value]) => !isNil(value))

    .map(
      ([key, value]) =>
        `export ${key}="${
          value
            ? bashEscape(value, {
                quotes: "double",
              })
            : ""
        }"`,
    );
};
