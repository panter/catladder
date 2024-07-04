import { existsSync, readFileSync } from "fs";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const tsx = require("tsx/cjs/api");

import { parse } from "yaml";
import type { Config } from "../types";

// allows us to load ts files

const fullPath = (directory: string, ext: string) =>
  directory + "/catladder." + ext;

export const readConfig = async (
  directory: string = process.cwd(),
): Promise<{ config: Config; path: string; ext: string } | null> => {
  const found = ["ts", "js", "yml", "yaml"].find((extension) =>
    existsSync(fullPath(directory, extension)),
  );

  if (found) {
    const filePath = fullPath(directory, found);
    if (found === "ts" || found === "js") {
      const result = await tsx.require(filePath, directory);

      // weird: if target project is esm, result is under result.default, but if its commonjs, its under result.default.default
      const config = result.default.default || result.default;
      return {
        path: filePath,
        ext: found,
        config,
      };
    } else {
      return {
        path: filePath,
        ext: found,
        config: parse(readFileSync(filePath, { encoding: "utf-8" })) as Config,
      };
    }
  }
  return null;
};
