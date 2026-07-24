import { registerGlobalScriptFunction } from "../globalScriptFunctions";

export const allowFailureInScripts = (script: string[]): string[] => [
  "set +e", // disable fail job on error
  ...script,
  "set -e", // reenable
];

export const sanitizeForBashVariable = (name: string) =>
  name.replace(/-/g, "_");

export const repeatOnFailure = (
  command: string,
  options: {
    pauseInSeconds: number;
    /**
     * fail the job after this many attempts — permanent errors (e.g. a
     * 403) must fail loudly instead of retrying until the job timeout
     */
    maxAttempts: number;
  },
): string => {
  return `
    _attempt=0
    until ${command}
    do
      _attempt=$((_attempt+1))
      if [ "$_attempt" -ge ${options.maxAttempts} ]; then
        echo "giving up after ${options.maxAttempts} attempts"
        exit 1
      fi
      echo "Trying again."
      sleep ${options.pauseInSeconds}
    done
  `;
};

const start = registerGlobalScriptFunction(
  "collapseable_section_start",
  `local section_title="\${1}"
  local section_description="\${2:-$section_title}"
  echo -e "section_start:\`date +%s\`:\${section_title}[collapsed=true]\\r\\e[0K$\{section_description}"
`,
);

const end = registerGlobalScriptFunction(
  "collapseable_section_end",
  `local section_title="\${1}"
  echo -e "section_end:\`date +%s\`:\${section_title}\\r\\e[0K"
`,
);

export const collapseableSection =
  (name: string, header: string) =>
  (commands: string[]): string[] => {
    return [
      start.invoke(`"${name}"`, `"${header}"`),
      ...commands,
      end.invoke(`"${name}"`),
    ];
  };
