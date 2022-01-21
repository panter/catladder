import { existsSync, readFileSync } from "fs";
import { register } from "ts-node";
import { parse } from "yaml";
import { Config } from "../types";

// allows us to load ts files

const fullPath = (directory: string, ext: string) =>
  directory + "/catladder." + ext;

export const readConfigSync = (
  directory: string = process.cwd()
): Config | null => {
  register({
    cwd: directory,
    transpileOnly: true,
    compilerOptions: {
      module: "commonjs",
    },
  });

  const found = ["ts", "js", "yml", "yaml"].find((extension) =>
    existsSync(fullPath(directory, extension))
  );
  if (found) {
    if (found === "ts" || found === "js") {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require(fullPath(directory, found)).default;
    } else {
      return parse(
        readFileSync(fullPath(directory, found), { encoding: "utf-8" })
      );
    }
  }
  return null;
};
