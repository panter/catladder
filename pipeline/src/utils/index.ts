import { isNil, mergeWith } from "lodash";

export function notNil<TValue>(
  value: TValue | null | undefined
): value is TValue {
  return value !== null && value !== undefined;
}

export const ensureArray = <T>(s: undefined | T | T[]): T[] | null =>
  isNil(s) ? null : Array.isArray(s) ? s : [s];

// see https://github.com/lodash/lodash/issues/5384
export const mergeWithMergingArrays = <A, B>(obj1: A, obj2: B): A & B => {
  return mergeWith({}, obj1, obj2, (prop1, prop2) =>
    Array.isArray(prop1) && Array.isArray(prop2)
      ? [...prop1, ...prop2]
      : undefined
  );
};
