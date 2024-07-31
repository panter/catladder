import type { VariableValue } from "./VariableValue";
import type { VariableValueContainingReferences } from "./VariableValueContainingReferences";
import { VariableReference } from "./VariableValueContainingReferences";
import { resolveReferencesOnce } from "./resolveReferencesOnce";

export const resolveAllReferencesOnce = async (
  values: Record<string, VariableValueContainingReferences>,
  getEnvVars: (
    componentName: string,
  ) => Promise<Record<string, VariableValue | undefined | null>>,
) => {
  const allReferences = Object.values(values).flatMap(
    (value) =>
      value?.parts.filter(
        (part) => part instanceof VariableReference,
      ) as VariableReference[],
  );

  const allComponentsUnique = Array.from(
    new Set(allReferences.map((reference) => reference.componentName)),
  );

  const allEnvVarsInComponents = Object.fromEntries(
    await Promise.all(
      allComponentsUnique.map(async (componentName) => [
        componentName,
        await getEnvVars(componentName),
      ]) as Array<
        Promise<[string, Record<string, VariableValue | undefined | null>]>
      >,
    ),
  );

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      value !== null && value !== undefined
        ? resolveReferencesOnce(value, ({ componentName, variableName }) => {
            return allEnvVarsInComponents[componentName][variableName];
          })
        : value,
    ]),
  );
};
