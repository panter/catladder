import type { VariableValue } from "./VariableValue";
import {
  UnresolvableReference,
  VariableReference,
  VariableValueContainingReferences,
} from "./VariableValueContainingReferences";

type Resolver = (args: {
  componentName: string;
  variableName: string;
}) => VariableValue | null | undefined;
export const resolveReferencesOnce = (
  value: VariableValueContainingReferences,
  resolver: Resolver,
) => {
  const replacedParts = value.parts.map((part) => {
    if (part instanceof VariableReference) {
      const result = resolver({
        componentName: part.componentName,
        variableName: part.variableName,
      });
      return result ?? new UnresolvableReference(part);
    } else {
      return part;
    }
  });

  return new VariableValueContainingReferences(replacedParts);
};
