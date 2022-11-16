export const allowFailureInScripts = (script: string[]): string[] => [
  "set +e", // disable fail job on error
  ...script,
  "set -e", // reenable
];

export const sanitizeForBashVariable = (name: string) =>
  name.replace(/-/g, "_");
