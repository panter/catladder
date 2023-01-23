import { isNil } from "lodash";

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
export const createArgsString = (
  args: Record<string, string | number | true | false | undefined>
) =>
  Object.entries(args)
    .filter(([, value]) => !isNil(value))
    .map(([key, value]) => {
      if (value === true) {
        return `--${key}`;
      } else if (value === false) {
        return `--no-${key}`;
      }
      return `--${key}=${value}`;
    })
    .join(" ");
