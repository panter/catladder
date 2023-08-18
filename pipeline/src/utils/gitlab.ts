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
  }
): string => {
  return `
    until ${command}
    do
      echo "Trying again."
      sleep ${options.pauseInSeconds}
    done
  `;
};

export const collapseableSection =
  (name: string, header: string) =>
  (commands: string[]): string[] => {
    return [
      `echo -e "\\e[0Ksection_start:$(date +%s):${name}[collapsed=true]\\r\\e[0K${header}"`,
      ...commands,
      `echo -e "\\e[0Ksection_end:$(date +%s):${name}\\r\\e[0K"`,
    ];
  };
