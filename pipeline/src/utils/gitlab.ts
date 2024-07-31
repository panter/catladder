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
  },
): string => {
  return `
    until ${command}
    do
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
