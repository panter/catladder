import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";

import type { CatladderStore } from "@catladder/pipeline";
import {
  catladderStoreSchema,
  getCatladderStorePath,
  readCatladderStore,
} from "@catladder/pipeline";
import { stringify } from "yaml";

import { getGitRoot } from "../utils/projects";

const HEADER = `# managed by catladder — written by \`catladder project setup\`.
# Non-secret, machine-fetched values needed to generate the pipeline.
# Check this file in. If it is missing, rerun \`catladder project setup\`.
`;

/**
 * applies an update to `.catladder-store/store.yml` at the git root,
 * creating the folder on first use
 */
export const updateCatladderStore = async (
  update: (store: CatladderStore) => CatladderStore,
) => {
  const root = (await getGitRoot()) ?? process.cwd();
  const store = readCatladderStore(root);
  const updated = catladderStoreSchema.parse(update(store));
  const path = getCatladderStorePath(root);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, HEADER + stringify(updated));
  return updated;
};
