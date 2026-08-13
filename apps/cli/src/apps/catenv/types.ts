import type { CatenvContext } from "@catladder/pipeline";
import type { IO } from "../../core/types";

/**
 * the pipeline's catenv context extended with the cli io context
 * (non-interactive when run via direnv)
 */
export type CatenvCliContext = CatenvContext & { io: IO };

import type { VariableValue } from "@catladder/pipeline";

export type Choice = {
  env?: string;
  componentName?: string;
};
