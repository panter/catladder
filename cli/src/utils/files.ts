import fs from "fs-extra";
import yaml from "js-yaml";

const readFile = async (file: string) =>
  fs.readFile(file, { encoding: "utf-8" });

export const readFileOrError = async (filePath: string) => {
  try {
    const file = await readFile(filePath);
    return [null, file];
  } catch (e) {
    return [e];
  }
};

export const readYaml = async <T = Record<string, any>>(filename: string) => {
  try {
    return yaml.load(await readFile(filename)) as T;
  } catch (e) {
    return null;
  }
};
