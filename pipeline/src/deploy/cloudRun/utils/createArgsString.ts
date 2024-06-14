import { isNil } from "lodash";
import type { BashExpression } from "../../../bash/BashExpression";

/**
 * creates arguments string:
 *
 * --key=value
 *
 * - undefined or null values will get removed completly
 * - true will just be "--key"
 * @param args args record
 * @returns
 */
export const createArgsString = (...args: keyValuesArg[]) =>
  args
    .map((argObj) =>
      Object.entries(argObj)
        .filter(([, value]) => !isNil(value))
        .map(([key, value]) => {
          if (value === true) {
            return `--${key}`;
          } else if (value === false) {
            return `--no-${key}`;
          }
          return `--${key}=${value}`;
        }),
    )
    .flat()
    .join(" ");

export type keyValuesArg = Record<
  string,
  string | number | true | false | undefined | BashExpression
>;
