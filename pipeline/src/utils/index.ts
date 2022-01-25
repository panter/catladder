import { isNil } from "lodash";

export function notNil<TValue>(
  value: TValue | null | undefined
): value is TValue {
  return value !== null && value !== undefined;
}

export const ensureArray = <T>(s: T | T[]): T[] | null =>
  isNil(s) ? null : Array.isArray(s) ? s : [s];
