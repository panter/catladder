import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
import { z } from "zod";

export const CATLADDER_STORE_DIR = ".catladder-store";
export const CATLADDER_STORE_FILE_NAME = "store.yml";
export const CATLADDER_STORE_FILE = `${CATLADDER_STORE_DIR}/${CATLADDER_STORE_FILE_NAME}`;

/**
 * schema of `.catladder-store/store.yml` — non-secret, machine-fetched
 * values that pipeline generation needs but that are neither part of the
 * user-authored config nor derivable from it (e.g. gcloud project numbers).
 *
 * The store is written by `catladder project setup` and checked into the
 * repository. Deleting the folder is safe: rerunning project setup
 * restores it.
 */
export const catladderStoreSchema = z.object({
  /**
   * gcloud project facts, keyed by project id
   */
  gcloudProjects: z
    .record(
      z.string(),
      z.object({
        projectNumber: z.string().regex(/^\d+$/),
      }),
    )
    .optional(),
});

export type CatladderStore = z.infer<typeof catladderStoreSchema>;

export const getCatladderStorePath = (directory: string) =>
  join(directory, CATLADDER_STORE_DIR, CATLADDER_STORE_FILE_NAME);

/**
 * reads and validates the catladder store. Returns an empty store when the
 * file does not exist (project setup has not run yet).
 *
 * An unreadable or invalid store is treated the same as a missing one
 * (with a warning): the store only holds machine-fetched values, so the
 * remedy is always rerunning project setup — not hand-editing the file.
 */
export const readCatladderStore = (
  directory: string = process.cwd(),
): CatladderStore => {
  const path = getCatladderStorePath(directory);
  if (!existsSync(path)) {
    return {};
  }
  try {
    return catladderStoreSchema.parse(
      parse(readFileSync(path, { encoding: "utf-8" })) ?? {},
    );
  } catch (error) {
    console.warn(
      `⚠️ ignoring invalid ${CATLADDER_STORE_FILE} (rerun "catladder project setup" to regenerate it): ${
        error instanceof Error ? error.message : error
      }`,
    );
    return {};
  }
};

/**
 * gcloud project number from the store, or null when it has not been
 * fetched yet. Use this where a missing number is not itself the problem —
 * `getGcloudProjectNumber` is the one that reports it.
 */
export const readGcloudProjectNumber = (
  config: { store?: CatladderStore },
  projectId: string,
): string | null =>
  config.store?.gcloudProjects?.[projectId]?.projectNumber ?? null;

/**
 * gcloud project number from the store — needed to compute deterministic
 * cloud run urls (`<service>-<projectNumber>.<region>.run.app`) at
 * generation time.
 *
 * Throws with a setup instruction when the value is missing, which makes
 * catenv fail until `catladder project setup` has stored it.
 */
export const getGcloudProjectNumber = (
  config: { store?: CatladderStore },
  projectId: string,
): string => {
  const projectNumber = readGcloudProjectNumber(config, projectId);
  if (!projectNumber) {
    throw new Error(
      `Missing gcloud project number for project "${projectId}" in ${CATLADDER_STORE_FILE}.\n` +
        `Run "catladder project setup" to fetch and store it.`,
    );
  }
  return projectNumber;
};
