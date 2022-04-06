import { existsSync, readFileSync } from "fs";
import { register } from "ts-node";
import { load } from "js-yaml";
import { Config } from "../types";

// allows us to load ts files

const fullPath = (directory: string, ext: string) =>
  directory + "/catladder." + ext;

function requireUncached(module: string) {
  delete require.cache[require.resolve(module)];
  return require(module);
}

export const readConfigSync = (
  directory: string = process.cwd()
): { config: Config; path: string; ext: string } | null => {
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
    const filePath = fullPath(directory, found);
    if (found === "ts" || found === "js") {
      return {
        path: filePath,
        ext: found,
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        config: requireUncached(filePath).default,
      };
    } else {
      return {
        path: filePath,
        ext: found,
        config: load(readFileSync(filePath, { encoding: "utf-8" })) as Config,
      };
    }
  }
  return null;
};
