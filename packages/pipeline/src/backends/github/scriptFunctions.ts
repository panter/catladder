import { globalScriptFunctions } from "@catladder/bash";

/**
 * github variants of the global script functions where the gitlab
 * implementation uses gitlab-specific mechanics (e.g. collapsible log
 * sections use gitlab's `section_start` escape codes, github uses
 * `::group::` workflow commands). All other functions are plain bash
 * and shared as-is.
 */
const GITHUB_FUNCTION_OVERRIDES: Record<string, string> = {
  collapseable_section_start: `local section_title="\${1}"
  local section_description="\${2:-$section_title}"
  echo "::group::\${section_description}"`,
  collapseable_section_end: `echo "::endgroup::"`,
};

/**
 * the bash function definitions to prepend to every job script.
 * github has no pipeline-wide before_script like gitlab, so each job
 * carries its own definitions.
 */
export const getGithubScriptFunctionDefinitions = (): string[] =>
  [...globalScriptFunctions.values()].map((fn) => {
    const override = GITHUB_FUNCTION_OVERRIDES[fn.name];
    return override
      ? `function ${fn.name} () {\n${override.trim()}\n}`
      : fn.toBashFunction();
  });
