import { withFile } from "tmp-promise";
import { parse, stringify } from "yaml";

import { readFile, writeFile } from "fs-extra";
import getEditor from "./getEditor";

export const editAsFile = async <T>(
  inObject: T,
  preamble?: string
): Promise<T> => {
  const fullPreamble = preamble
    ? `#
# ${preamble.split("\n").join("\n# ")}
#

`
    : "\n";
  const asString =
    fullPreamble + stringify(inObject, { aliasDuplicateObjects: false });
  let newContent: T;

  await withFile(
    async ({ path: tmpFilePath }) => {
      await writeFile(tmpFilePath, asString);
      await (await getEditor()).open(tmpFilePath);
      newContent = parse((await readFile(tmpFilePath)).toString("utf-8")) as T;
    },
    { postfix: ".yml" }
  );

  return newContent;
};
