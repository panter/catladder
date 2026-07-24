import { readFile, writeFile, mkdir, cp, chmod } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { parse, stringify } from "yaml";

const legacyPreferencesPath = join(homedir(), ".catladder/preferences.yml");
const preferencesPath = join(homedir(), ".config/catladder/preferences.yml");

const ensurePreferencesFile = async () => {
  if (existsSync(preferencesPath)) {
    return;
  }
  await mkdir(dirname(preferencesPath), { recursive: true, mode: 0o700 });
  if (!existsSync(legacyPreferencesPath)) {
    return writeFile(preferencesPath, "---\n{}", {
      encoding: "utf-8",
      mode: 0o600,
    });
  }
  await cp(legacyPreferencesPath, preferencesPath);
  await chmod(preferencesPath, 0o600);
  await cp(
    preferencesPath,
    join(dirname(preferencesPath), "old_preferences_backup.yml"),
  );
};

const loadPreferences = async () => {
  await ensurePreferencesFile();
  return readFile(preferencesPath, { encoding: "utf-8" });
};

export const getPreferences = async () => {
  const yamlContent = await loadPreferences();
  return (parse(yamlContent) ?? {}) as Record<string, string>;
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

  await writeFile(preferencesPath, stringify(newPreferences), {
    encoding: "utf-8",
    mode: 0o600,
  });
};
