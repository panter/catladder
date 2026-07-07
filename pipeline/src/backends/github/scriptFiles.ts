import { join } from "path";
import type { PipelineFile } from "../types";

/**
 * folder for job scripts materialized into the repository (committed,
 * like the image definitions). Owned entirely by the github backend.
 */
export const GITHUB_SCRIPTS_FOLDER = ".catladder-generated/github/scripts";

/**
 * github silently ignores workflow files larger than 512 KB — no run,
 * no check suite, no error. Inlining every job's bash script blows past
 * that limit on bigger projects, so job scripts are materialized into
 * committed files and the workflow step only invokes them.
 *
 * Scripts containing `${{ ... }}` expressions must stay inline: the
 * runner only interpolates expressions in the workflow file itself,
 * never in files read at runtime.
 */
export class GithubScriptFiles {
  private files = new Map<string, string>();

  /**
   * materializes a job script into a committed file and returns the
   * step command invoking it
   */
  add(jobId: string, script: string): string {
    const path = join(GITHUB_SCRIPTS_FOLDER, `${jobId}.sh`);
    // `shell: bash` steps run with `bash -eo pipefail`; the script file
    // must fail exactly like the inline version did
    const content = `#!/usr/bin/env bash\nset -eo pipefail\n\n${script}\n`;
    const existing = this.files.get(path);
    if (existing !== undefined && existing !== content) {
      throw new Error(`conflicting scripts for job id '${jobId}'`);
    }
    this.files.set(path, content);
    return `bash ${path}`;
  }

  getGeneratedFiles(): PipelineFile[] {
    return [...this.files.entries()].map(([path, content]) => ({
      path,
      content,
    }));
  }
}
