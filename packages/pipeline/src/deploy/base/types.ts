import type { CatladderJobSpec } from "../../types/jobs";

export type JobWithoutScript = Omit<CatladderJobSpec, "script">;
