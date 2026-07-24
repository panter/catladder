import { readFile as fsExtraReadFile } from "fs-extra";

const readFile = (file: string) => fsExtraReadFile(file, { encoding: "utf-8" });

export const readFileOrError = async (filePath: string) => {
  try {
    const file = await readFile(filePath);
    return [null, file];
  } catch (e) {
    return [e];
  }
};
