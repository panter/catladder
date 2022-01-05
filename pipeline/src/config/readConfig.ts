import { existsSync, readFileSync } from "fs";
import { register } from "ts-node";
import { parse } from "yaml";
import { Config } from "../types";

// allows us to load ts files
register({
  transpileOnly: true,
});

const fullPath = (ext: string) => process.cwd() + "/catladder." + ext;

export const readConfigSync = (): Config | null => {
  const found = ["ts", "js", "yml", "yaml"].find((extension) =>
    existsSync(fullPath(extension))
  );
  if (found) {
    if (found === "ts" || found === "js") {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require(fullPath(found)).default;
    } else {
      return parse(readFileSync(fullPath(found), { encoding: "utf-8" }));
    }
  }
  return null;
};
