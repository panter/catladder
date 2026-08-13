export const jsonParseOrThrow = (str: string): any => {
  try {
    return JSON.parse(str);
  } catch (e) {
    throw new Error(`could not parse json: ${str}`);
  }
};
