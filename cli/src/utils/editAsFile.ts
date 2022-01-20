import { withFile } from "tmp-promise";
import yaml from "js-yaml";

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
  const asString = fullPreamble + yaml.safeDump(inObject, { noRefs: true });
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
