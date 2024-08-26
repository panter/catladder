import { createFile, pathExists, readFile, writeFile } from "fs-extra";
import { homedir } from "os";

import { parse, stringify } from "yaml";
const directory = `${homedir()}/.catladder`;
const file = `${directory}/preferences.yml`;

const getPreferences = async () => {
  if (!(await pathExists(file))) {
    await createFile(file);
  }
  return (parse(await readFile(file, { encoding: "utf-8" })) ?? {}) as Record<
    string,
    string
  >;
};

export const hasPreference = async (key: string) => {
  const preferences = await getPreferences();
  return key in preferences;
};
export const getPreference = async (key: string) => {
  const preferences = await getPreferences();
  return preferences[key];
};

export const setPreference = async (key: string, value: string | number) => {
  const preferences = await getPreferences();

  const newPreferences = {
    ...preferences,
    [key]: value,
  };

  await writeFile(file, stringify(newPreferences));
};
