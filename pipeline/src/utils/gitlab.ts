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
    until ${command} &> /dev/null
    do
      echo "Trying again."
      sleep ${options.pauseInSeconds}
    done
  `;
};
