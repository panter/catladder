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
  args: Record<string, string | number | true | undefined>
) =>
  Object.entries(args)
    .filter(([, value]) => !isNil(value))
    .map(([key, value]) => `--${key}${value !== true ? `=${value}` : ""}`)
    .join(" ");
