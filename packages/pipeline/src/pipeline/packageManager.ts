import { existsSync } from "fs";
import { join } from "path";
import { pathEqual } from "path-equal";
import type {
  Config,
  PackageManagerInfoBase,
  PackageManagerInfoComponent,
} from "../types";
import { detectPackageManager } from "./detectPackageManager";
import { getPnpmWorkspaces } from "./pnpm/pnpmUtils";
import { getWorkspaces, getWorkspaceDependencies } from "./yarn/yarnUtils";
import memoizee from "memoizee";

const PACKAGE_MANAGER_FILES = {
  yarn: {
    lockFile: "yarn.lock",
    configFiles: [".yarnrc", ".yarnrc.yml", ".npmrc", ".yarn"], // ".yarn" is yarn 2 folder
  },
  pnpm: {
    lockFile: "pnpm-lock.yaml",
    configFiles: ["pnpm-workspace.yaml", ".npmrc", ".pnpmfile.cjs"],
  },
} as const;

export const getPackageManagerInfoForComponent = async (
  config: Config,
  componentName: string,
): Promise<PackageManagerInfoComponent> => {
  const baseInfo = await getPackageManagerInfoBase(config);
  const { workspaces } = baseInfo;

  const component = config.components[componentName];
  const currentWorkspace = workspaces.find((w) =>
    pathEqual(component.dir, w.location),
  );
  const componentIsInWorkspace = Boolean(currentWorkspace);
  const workspaceRoot = "."; // currently we assume the root folder, later on we might support nested workspaces
  const packageJson = join(component.dir, "package.json");
  const workspacePackageJson = componentIsInWorkspace
    ? join(workspaceRoot, "package.json")
    : null;

  const { lockFile: lockFileName, configFiles } =
    PACKAGE_MANAGER_FILES[baseInfo.type];
  const lockFile = componentIsInWorkspace
    ? join(workspaceRoot, lockFileName)
    : join(component.dir, lockFileName);
  // copy all those configFiles from workspace root and/or component folder

  const configFilePaths = [
    ...configFiles,
    ...configFiles.map((f) => join(component.dir, f)),
  ].filter((f) => existsSync(f));

  // get all folders that this workspace depend on
  // we will later copy them into the docker build
  const currentWorkspaceDependencies = currentWorkspace
    ? getWorkspaceDependencies(currentWorkspace, workspaces)
    : [];

  // pnpm's --frozen-lockfile check requires every importer of the
  // lockfile to exist on disk, so all workspace manifests (not just the
  // dependency workspaces, which are copied entirely) go into the image
  const allWorkspaceManifests =
    baseInfo.type === "pnpm" && componentIsInWorkspace
      ? workspaces
          .map((w) => join(w.location, "package.json"))
          .filter((f) => existsSync(f))
      : [];

  const pathsToCopyInDocker = [
    ...new Set([
      packageJson,
      ...(workspacePackageJson ? [workspacePackageJson] : []),
      lockFile,
      ...configFilePaths,
      ...allWorkspaceManifests,
      ...currentWorkspaceDependencies,
    ]),
  ];
  return {
    ...baseInfo,
    currentWorkspace,
    currentWorkspaceDependencies,
    componentIsInWorkspace,
    pathsToCopyInDocker,
  };
};

const _getPackageManagerInfoBase = async (
  config?: Config,
): Promise<PackageManagerInfoBase> => {
  const { type, version } = await detectPackageManager(config?.packageManager);
  if (!version) throw new Error(`could not get ${type} version`);

  if (type === "pnpm") {
    return {
      type: "pnpm",
      workspaces: await getPnpmWorkspaces(),
      version,
    };
  }

  const isClassic = version.startsWith("1");
  const workspaces = await getWorkspaces(isClassic);

  return {
    type: "yarn",
    workspaces,
    version,
    isClassic,
  };
};

export const getPackageManagerInfoBase = memoizee(_getPackageManagerInfoBase, {
  promise: true,
  // memoize per explicit packageManager choice, not per config identity
  normalizer: ([config]) => config?.packageManager ?? "",
});
