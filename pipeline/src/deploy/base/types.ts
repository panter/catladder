import type { CatladderJob } from "../../types/jobs";

export type JobWithoutScript = Omit<CatladderJob, "script">;
