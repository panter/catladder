import { existsSync, readFileSync } from "fs";
import { createJiti } from "jiti";

import { parse } from "yaml";
import { readCatladderStore } from "../store";
import type { Config } from "../types";

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
    // machine-fetched values (written by `catladder project setup`) are
    // attached to the config here, so everything downstream can rely on
    // `config.store`
    const store = readCatladderStore(directory);
    if (found === "ts" || found === "js") {
      const jiti = createJiti(directory);
      const result = await jiti.import(filePath);

      const config = (result as any).default || result;
      return {
        path: filePath,
        ext: found,
        config: { ...(config as Config), store },
      };
    } else {
      return {
        path: filePath,
        ext: found,
        config: {
          ...(parse(readFileSync(filePath, { encoding: "utf-8" })) as Config),
          store,
        },
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
  - The TypeScript loader (jiti) used by catladder needs to understand the syntax in your project.
    If your project uses newer TypeScript/JavaScript syntax, you may need to update catladder.
  - Missing or incorrect dependencies in your project
  - TypeScript configuration issues in your tsconfig.json
`);
    return null;
  }
};
