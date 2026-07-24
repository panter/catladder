import { BashExpression } from "../BashExpression";
import type { EscapeOptions } from "../bashEscape";
import { escapeBashExpression, escapeString } from "../bashEscape";

export class UnresolvableReference {
  constructor(public reference: VariableReference) {}
  public toString() {
    return `Unresolvable reference: ${this.reference.toString()}`;
  }
}
export class VariableReference {
  public componentName: string;
  public variableName: string;

  constructor(componentName: string, variableName: string) {
    this.componentName = componentName;
    this.variableName = variableName;
  }

  public toString() {
    return `\${${this.componentName}:${this.variableName}}`;
  }
}

type VariableValuePart =
  | string
  | BashExpression
  | VariableReference
  | UnresolvableReference;

type MaybeArray<T> = T | T[];
export class VariableValueContainingReferences {
  public parts: VariableValuePart[];
  constructor(
    parts: MaybeArray<VariableValuePart | VariableValueContainingReferences>,
  ) {
    this.parts = (Array.isArray(parts) ? parts : [parts]).flatMap((part) =>
      part instanceof VariableValueContainingReferences
        ? part.parts
        : part === ""
          ? []
          : [part],
    );
  }

  public toString(
    options: EscapeOptions = {
      quotes: false,
    },
  ) {
    return this.parts
      .map((part) => {
        if (typeof part === "string") {
          return escapeString(part, options);
        } else if (part instanceof BashExpression) {
          return escapeBashExpression(part, options);
        } else {
          return part.toString();
        }
      })
      .join("");
  }
}

// regex to resolve references in catladder variables
// those expressions have the pattern ${componentName:variableName}
const REGEX = /\$\{(([^:}]+):)?([^}]+)}/gm;
export const createVariableValueContainingReferencesFromString = (
  value: string,
  options: { componentName: string },
) => {
  const parts: Array<VariableValuePart> = [];
  let match: any;
  let lastIndex = 0;
  while ((match = REGEX.exec(value)) !== null) {
    const [fullMatch, _, otherComponentName, variableName] = match;

    parts.push(value.slice(lastIndex, match.index));
    parts.push(
      new VariableReference(
        otherComponentName || options.componentName,
        variableName,
      ),
    );
    lastIndex = REGEX.lastIndex;
  }
  parts.push(value.slice(lastIndex));
  return new VariableValueContainingReferences(parts);
};
