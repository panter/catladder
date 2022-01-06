import { withFile } from "tmp-promise";
import yaml from "js-yaml";

import { readFile, writeFile } from "fs-extra";
import getEditor from "./getEditor";

export const editAsFile = async <T>(inObject: T): Promise<T> => {
  const asString = yaml.safeDump(inObject);
  let newContent;

  await withFile(
    async ({ path: tmpFilePath }) => {
      await writeFile(tmpFilePath, asString);
      await (await getEditor()).open(tmpFilePath);
      newContent = yaml.load((await readFile(tmpFilePath)).toString("utf-8"));
    },
    { postfix: ".yml" }
  );

  return newContent;
};
