import { merge } from "lodash";

const REGEX = /\$\{(([^:]+):)?([^}]+)}/gm;

export const resolveReferences = (
  vars: Record<string, string>,
  getOtherVariables?: (
    componentName: string,
    variableName: string
  ) => string | null
) => {
  const replaceSingleValue = (
    value: string,
    alreadyVisited: Record<string, Record<string, boolean>> = {}
  ): string => {
    if (REGEX.test(value)) {
      return value.replace(REGEX, (match, _, componentName, variableName) => {
        if (alreadyVisited[componentName]?.[variableName]) {
          return match; // prevent endless loop
        }
        const result = componentName
          ? getOtherVariables?.(componentName, variableName) ?? null
          : vars[variableName]; // is self reference

        const replaced =
          result !== null && result !== undefined
            ? replaceSingleValue(
                result,
                merge({}, alreadyVisited, {
                  [componentName]: {
                    [variableName]: true,
                  },
                })
              )
            : match;

        return replaced;
      });
    } else {
      return value;
    }
  };

  return Object.fromEntries(
    Object.entries(vars).map(([key, value]) => {
      return [key, replaceSingleValue(value)];
    })
  );
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
