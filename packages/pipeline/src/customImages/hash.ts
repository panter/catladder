import type { Hash } from "crypto";
import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
/**
 * input for content-hashing an image definition. `extraDirs` covers
 * image definitions that include other image dirs (dockerfile INCLUDE).
 */
export type ImageHashConfig = {
  dir: string;
  extraDirs?: string[];
  hashExtraPaths?: string[];
  buildArgs?: Record<string, string>;
};

export type CustomImageHashResult = {
  hash: string;
  watchedPaths: string[];
};

const IGNORED_FILES = new Set([".DS_Store", "Thumbs.db"]);
const isIgnoredFile = (path: string) =>
  IGNORED_FILES.has(path.split("/").pop() ?? "");

function listFilesRecursive(dir: string): string[] {
  const resolved = resolve(dir);
  const entries = readdirSync(resolved, { recursive: true, encoding: "utf-8" });
  return entries
    .filter((entry) => {
      if (isIgnoredFile(entry)) {
        // OS junk files exist locally but not in CI checkouts — they
        // must never influence the content hash
        return false;
      }
      const fullPath = join(resolved, entry);
      return statSync(fullPath).isFile();
    })
    .sort();
}

/**
 * the parts every image definition hashes on top of its content:
 * files outside the definition, and the build args
 */
function hashExtras(
  hash: Hash,
  config: Pick<ImageHashConfig, "hashExtraPaths" | "buildArgs">,
): string[] {
  const watchedPaths: string[] = [];

  // Hash extra paths (for files outside the dir)
  if (config.hashExtraPaths) {
    // Extra paths are literal file paths (not globs) for simplicity
    const extraFiles = [...config.hashExtraPaths].sort();
    for (const file of extraFiles) {
      hash.update(file);
      hash.update(readFileSync(file));
    }
    watchedPaths.push(...config.hashExtraPaths);
  }

  // Hash build args (sorted keys for determinism)
  if (config.buildArgs) {
    const sorted = Object.entries(config.buildArgs).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    hash.update(JSON.stringify(sorted));
  }

  return watchedPaths;
}

export function computeCustomImageHash(
  config: ImageHashConfig,
): CustomImageHashResult {
  const hash = createHash("sha256");
  const watchedPaths: string[] = [];

  // Hash all files in the dir (includes the Dockerfile and any context files)
  const dirFiles = listFilesRecursive(config.dir);

  for (const file of dirFiles) {
    const fullPath = join(resolve(config.dir), file);
    hash.update(file); // include relative path for disambiguation
    hash.update(readFileSync(fullPath));
  }
  watchedPaths.push(`${config.dir}/**/*`);

  // extra dirs (e.g. included base image definitions)
  for (const extraDir of config.extraDirs ?? []) {
    for (const file of listFilesRecursive(extraDir)) {
      hash.update(file);
      hash.update(readFileSync(join(resolve(extraDir), file)));
    }
    watchedPaths.push(`${extraDir}/**/*`);
  }

  watchedPaths.push(...hashExtras(hash, config));

  return {
    hash: hash.digest("hex").slice(0, 12),
    watchedPaths,
  };
}

/**
 * the hash of an image defined by an inline Dockerfile: its content
 * stands in for the definition dir. The build context is deliberately
 * NOT hashed (it may be the whole repository) — `hashExtraPaths` is how
 * context files opt into the hash.
 */
export function computeInlineImageHash(
  config: Pick<ImageHashConfig, "hashExtraPaths" | "buildArgs"> & {
    dockerfileContent: string;
  },
): CustomImageHashResult {
  const hash = createHash("sha256");
  hash.update(config.dockerfileContent);
  const watchedPaths = hashExtras(hash, config);

  return {
    hash: hash.digest("hex").slice(0, 12),
    watchedPaths,
  };
}
