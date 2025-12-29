import { existsSync, readFileSync } from "fs";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsx = require("tsx/cjs/api");

import { parse } from "yaml";
import type { Config } from "../types";

// allows us to load ts files

const fullPath = (directory: string, ext: string) =>
  directory + "/catladder." + ext;

const readConfigInternal = async (
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

export const readConfig = async (
  directory: string = process.cwd(),
): Promise<{ config: Config; path: string; ext: string } | null> => {
  try {
    return await readConfigInternal(directory);
  } catch (error) {
    console.error(`Error reading config in ${directory}:`, error);
    console.error(`
This may happen due to various reasons:
  - Syntax errors in your catladder.ts file
  - tsx (the TypeScript loader used by catladder) needs to understand the syntax in your project.
    If your project uses newer TypeScript/JavaScript syntax, you may need to update catladder
    to get a newer version of tsx that supports it.
  - Missing or incorrect dependencies in your project
  - TypeScript configuration issues in your tsconfig.json
`);
    return null;
  }
};
