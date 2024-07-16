import { join } from "path";
import type {
  BuildConfigStandalone,
  CacheConfig,
  CacheConfigAdvanced,
  CacheConfigSimple,
  WorkspaceBuildConfig,
} from "..";
import type { Context } from "../../types";
import type { CatladderJobCache } from "../../types/jobs";
import { getAllCacheConfigsFromConfig } from "./getAllCacheConfigsFromConfig";

export const createJobCacheFromCacheConfigs = (
  context: Context,
  caches: CacheConfig[],
): CatladderJobCache[] | undefined => {
  if (caches.length === 0) return undefined;

  const simpleCacheDefs = caches.filter(
    (c): c is CacheConfigSimple => !("key" in c),
  );
  const advancedCacheDefs = caches.filter(
    (c): c is CacheConfigAdvanced => "key" in c,
  );
  // simple caches are merged together into one. This is because e.g. gitlab has a limit of 4 caches, see https://gitlab.com/gitlab-org/gitlab/-/issues/421962
  const simpleCaches =
    simpleCacheDefs.length > 0
      ? [
          {
            key: context.name + "-default",
            policy: "pull-push",
            paths: simpleCacheDefs.flatMap((c) =>
              c.paths.map((p) => {
                const baseDir =
                  c.pathMode === "absolute"
                    ? ""
                    : c.baseDir ?? context.build.dir;
                return join(baseDir, p);
              }),
            ),
          },
        ]
      : [];

  const advancedCaches = advancedCacheDefs.map(
    ({ key, paths, policy, scope, pathMode, buildDir, ...rest }) => {
      const baseDir =
        pathMode === "absolute" ? "" : buildDir ?? context.build.dir;
      const transformedKey =
        scope === "global"
          ? key
          : typeof key === "string"
            ? (scope === "buildDir" // really edge case...
                ? baseDir
                : context.name) +
              "-" +
              key
            : {
                ...key,
                files: key.files?.map((f) =>
                  pathMode === "absolute" ? f : join(baseDir, f),
                ),
              };
      return {
        key: transformedKey,
        policy: policy ?? "pull-push",
        paths:
          pathMode === "absolute" ? paths : paths?.map((p) => join(baseDir, p)),
        ...rest,
      };
    },
  );
  return [...advancedCaches, ...simpleCaches];
};

/** shortcut, used in some build types */
export const createJobCacheFromConfig = (
  context: Context,
  buildConfig: BuildConfigStandalone | WorkspaceBuildConfig,
) => {
  return createJobCacheFromCacheConfigs(
    context,
    getAllCacheConfigsFromConfig(context, buildConfig),
  );
};
