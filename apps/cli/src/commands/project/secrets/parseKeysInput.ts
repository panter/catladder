/** parses a comma-separated `--key` input into a list of keys */
export const parseKeysInput = (input?: string): string[] | undefined => {
  const keys = input
    ?.split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  return keys && keys.length > 0 ? keys : undefined;
};
