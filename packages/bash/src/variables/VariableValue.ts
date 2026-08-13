import type { BashExpression } from "../BashExpression";
import type { VariableValueContainingReferences } from "./VariableValueContainingReferences";
export type VariableValue =
  | VariableValueContainingReferences
  | BashExpression
  | string;
