import { merge } from "lodash";

import type { BashExpression } from "../bash/BashExpression";
import replaceAsync from "../bash/replaceAsync";
import type { UnspecifiedEnvVars } from "..";

// regex to resolve references in catladder variables
// those expressions have the pattern ${componentName:variableName}
const REGEX = /\$\{(([^:}]+):)?([^}]+)}/gm;

export const resolveReferences = async (
  vars: Record<string, string | BashExpression | undefined | null>,
  getOtherVariables?: (
    componentName: string,
    alreadyVisited: Record<string, Record<string, boolean>>,
  ) => Promise<UnspecifiedEnvVars>,
  alreadyVisitedBase: Record<string, Record<string, boolean>> = {},
) => {
  /**
   *
   * replace referenced variables with their values in a value string
   */
  const replaceSingleValue = async (
    value: string | BashExpression,
    alreadyVisited: Record<
      string,
      Record<string, boolean>
    > = alreadyVisitedBase,
  ): Promise<string | BashExpression> => {
    if (REGEX.test(value.toString())) {
      // we consider variables that got references in it  BashExpressions, because the replacement may be one

      return await replaceAsync(
        value,
        REGEX,
        async (match, _, componentName, variableName) => {
          if (alreadyVisited[componentName]?.[variableName]) {
            return match; // prevent endless loop
          }
          const newAlreadyVisited = merge({}, alreadyVisited, {
            [componentName]: {
              [variableName]: true,
            },
          });
          const result = componentName
            ? (await getOtherVariables?.(componentName, newAlreadyVisited).then(
                (r) => r?.[variableName],
              )) ?? null
            : vars[variableName]; // is self reference

          const replaced =
            result !== null && result !== undefined
              ? await replaceSingleValue(result, newAlreadyVisited)
              : match;

          return replaced;
        },
      );
    } else {
      return value;
    }
  };

  return Object.fromEntries(
    await Promise.all(
      Object.entries(vars).map(async ([key, value]) => {
        if (value === null || value === undefined) {
          return [key, null];
        }

        return [
          key,
          value !== null && value !== undefined
            ? await replaceSingleValue(value)
            : null,
        ];
      }),
    ),
  ) as Record<string, BashExpression>;
};
