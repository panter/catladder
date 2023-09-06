import { existsSync } from "fs";
import { join } from "path";
import { pathEqual } from "path-equal";
import type { Config, PackageManagerInfo } from "../types";
import {
  getWorkspaces,
  getYarnVersion,
  getWorkspaceDependencies,
} from "./yarn/yarnUtils";

export const getPackageManagerInfo = async (
  config: Config,
  componentName: string
): Promise<PackageManagerInfo> => {
  // currently only supports yarn
  const version = await getYarnVersion();
  if (!version) throw new Error("could not get yarn version");
  const isClassic = version.startsWith("1");

  const component = config.components[componentName];
  const workspaces = await getWorkspaces(isClassic);
  const currentWorkspace = workspaces.find((w) =>
    pathEqual(component.dir, w.location)
  );
  const componentIsInWorkspace = Boolean(currentWorkspace);
  const workspaceRoot = "."; // currently we assume the root folder, later on we might support nested workspaces
  const packageJson = join(component.dir, "package.json");
  const workspacePackageJson = componentIsInWorkspace
    ? join(workspaceRoot, "package.json")
    : null;

  const lockFile = componentIsInWorkspace
    ? join(workspaceRoot, "yarn.lock")
    : join(component.dir, "yarn.lock");
  const configFiles = [".yarnrc", ".yarnrc.yml", ".npmrc", ".yarn"]; // ".yarn" is yarn 2 folder
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

  const pathsToCopyInDocker = [
    packageJson,
    ...(workspacePackageJson ? [workspacePackageJson] : []),
    lockFile,
    ...configFilePaths,
    ...currentWorkspaceDependencies,
  ];
  return {
    type: "yarn",
    workspaces,
    version,
    isClassic,
    currentWorkspace,
    currentWorkspaceDependencies,
    componentIsInWorkspace,
    pathsToCopyInDocker,
  };
};
