import { withFile } from "tmp-promise";
import { dump, load } from "js-yaml";

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
  const asString = fullPreamble + dump(inObject, { noRefs: true });
  let newContent: T;

  await withFile(
    async ({ path: tmpFilePath }) => {
      await writeFile(tmpFilePath, asString);
      await (await getEditor()).open(tmpFilePath);
      newContent = load((await readFile(tmpFilePath)).toString("utf-8")) as T;
    },
    { postfix: ".yml" }
  );

  return newContent;
};
