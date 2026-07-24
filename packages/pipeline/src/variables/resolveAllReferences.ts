import type { VariableValue } from "./VariableValue";
import type { VariableValueContainingReferences } from "./VariableValueContainingReferences";
import { VariableReference } from "./VariableValueContainingReferences";
import { resolveAllReferencesOnce as resolveAllReferencesOnce } from "./resolveAllReferencesOnce";

export const resolveAllReferences = async (
  values: Record<string, VariableValueContainingReferences>,
  getEnvVars: (
    componentName: string,
  ) => Promise<Record<string, VariableValue | null | undefined>>,
) => {
  // replace until there aren't any references left
  let result = values;

  let i = 0;

  while (
    Object.values(result).some((value) =>
      value.parts.some((part) => part instanceof VariableReference),
    )
  ) {
    const replaced = await resolveAllReferencesOnce(result, getEnvVars);

    result = replaced;
    i++;
    if (i > 1000) {
      const unresolved = Object.entries(result).filter(([key, value]) =>
        value.parts.some((part) => part instanceof VariableReference),
      );

      throw new Error(
        "Infinite loop detected in these variables: " +
          unresolved
            .map(
              ([key, value]) =>
                `${key} (last reference: ${value.parts.find(
                  (part) => part instanceof VariableReference,
                )})`,
            )
            .join(", "),
      );
    }
  }

  return result;
};
