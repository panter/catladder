import type { VariableValue } from "./VariableValue";
import {
  VariableReference,
  VariableValueContainingReferences,
} from "./VariableValueContainingReferences";
import { resolveAllReferencesOnce as resolveAllReferencesOnce } from "./resolveAllReferencesOnce";

const hasUnresolvedReferences = (value: VariableValue | null | undefined) =>
  value instanceof VariableValueContainingReferences &&
  value.parts.some((part) => part instanceof VariableReference);

export const resolveAllReferences = async <
  T extends Record<string, VariableValue | null | undefined>,
>(
  values: T,
  getEnvVars: (
    componentName: string,
  ) => Promise<Record<string, VariableValue | null | undefined>>,
): Promise<T> => {
  // replace until there aren't any references left
  let result = values;

  let i = 0;

  while (Object.values(result).some(hasUnresolvedReferences)) {
    const replaced = await resolveAllReferencesOnce(result, getEnvVars);

    result = replaced;
    i++;
    if (i > 1000) {
      const unresolved = Object.entries(result).filter(([key, value]) =>
        hasUnresolvedReferences(value),
      );

      throw new Error(
        "Infinite loop detected in these variables: " +
          unresolved
            .map(
              ([key, value]) =>
                `${key} (last reference: ${(
                  value as VariableValueContainingReferences
                ).parts.find((part) => part instanceof VariableReference)})`,
            )
            .join(", "),
      );
    }
  }

  return result;
};
