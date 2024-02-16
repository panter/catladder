import { merge } from "lodash";
import replaceAsync from "string-replace-async";

const REGEX = /\$\{(([^:}]+):)?([^}]+)}/gm;

export const resolveReferences = async (
  vars: Record<string, string>,
  getOtherVariables?: (
    componentName: string,
    alreadyVisited: Record<string, Record<string, boolean>>
  ) => Promise<Record<string, string | null>>,
  alreadyVisitedBase: Record<string, Record<string, boolean>> = {}
) => {
  const replaceSingleValue = async (
    value: string,
    alreadyVisited: Record<string, Record<string, boolean>> = alreadyVisitedBase
  ): Promise<string> => {
    if (REGEX.test(value)) {
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
                (r) => r?.[variableName]
              )) ?? null
            : vars[variableName]; // is self reference

          const replaced =
            result !== null && result !== undefined
              ? await replaceSingleValue(result, newAlreadyVisited)
              : match;

          return replaced;
        }
      );
    } else {
      return value;
    }
  };

  return Object.fromEntries(
    await Promise.all(
      Object.entries(vars).map(async ([key, value]) => {
        return [key, await replaceSingleValue(value)];
      })
    )
  ) as Record<string, string>;
};

export const translateLegacyFromComponents = (
  fromComponents: Record<string, Record<string, string>>
) => {
  return Object.fromEntries(
    Object.entries(fromComponents).flatMap(([componentName, variables]) => {
      return Object.entries(variables).map(([ourName, otherName]) => [
        ourName,
        "${" + componentName + ":" + otherName + "}",
      ]);
    })
  );
};
