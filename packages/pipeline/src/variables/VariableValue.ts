import type { BashExpression } from "../bash/BashExpression";
import type { VariableValueContainingReferences } from "./VariableValueContainingReferences";
export type VariableValue =
  | VariableValueContainingReferences
  | BashExpression
  | string;
