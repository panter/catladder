import type { VariableValue } from "./VariableValue";
import {
  VariableReference,
  VariableValueContainingReferences,
} from "./VariableValueContainingReferences";
import { resolveReferencesOnce } from "./resolveReferencesOnce";

export const resolveAllReferencesOnce = async <
  T extends Record<string, VariableValue | null | undefined>,
>(
  values: T,
  getEnvVars: (
    componentName: string,
  ) => Promise<Record<string, VariableValue | undefined | null>>,
): Promise<T> => {
  const allReferences = Object.values(values).flatMap((value) =>
    value instanceof VariableValueContainingReferences
      ? (value.parts.filter(
          (part) => part instanceof VariableReference,
        ) as VariableReference[])
      : [],
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
      value instanceof VariableValueContainingReferences
        ? resolveReferencesOnce(value, ({ componentName, variableName }) => {
            return allEnvVarsInComponents[componentName][variableName];
          })
        : value,
    ]),
  ) as T;
};
