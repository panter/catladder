import type { Config, PipelineType } from "../types";

export type PipelineFile = {
  path: string;
  content: Record<string, unknown>;
};

/**
 * A pipeline backend renders catladder jobs into the files of a concrete
 * CI system (gitlab today, github actions in the future).
 *
 * Everything that is specific to a CI system (job yaml shapes, rules,
 * stages, file layout, includes, ...) belongs behind this interface.
 * The rest of the codebase should only produce platform-neutral jobs.
 *
 * Multiple backends can be active for the same repository (e.g. during a
 * step-by-step migration from gitlab to github): each backend owns its
 * `generatedFolder` and generates its own set of files.
 */
export interface PipelineBackend {
  readonly type: PipelineType;

  /**
   * removes previously generated files of this backend.
   * Called before the files are written.
   *
   * Backends must only remove files they own (e.g. the github backend
   * shares `.github/workflows` with user-maintained workflows and only
   * removes its own, prefixed files).
   */
  cleanup(): Promise<void>;

  /**
   * create all pipeline files for this backend.
   * Paths are relative to the repository root.
   */
  createFiles(config: Config): Promise<PipelineFile[]>;
}
