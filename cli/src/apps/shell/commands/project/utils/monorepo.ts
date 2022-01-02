import { existsSync, readdirSync } from "fs-extra";
import { join } from "path";
import { CommandInstance } from "vorpal";
import { getGitRoot } from "../../../../../utils/projects";

export const getSubAppsInMonoRepo = async () => {
  const gitRoot = await getGitRoot();
  return readdirSync(gitRoot)
    .map((dir) => ({
      componentName: dir,
      ci: join(gitRoot, dir, ".gitlab-ci.yml"),
      path: join(gitRoot, dir),
    }))
    .filter(({ ci }) => existsSync(ci));
};

export const getCurrentSubApp = async () => {
  const gitRoot = await getGitRoot();
  const subApps = await getSubAppsInMonoRepo();
  const currentDir = process.cwd();
  return subApps.find((a) =>
    currentDir.startsWith(join(gitRoot, a.componentName))
  );
};

export const promptForSubAppIfAny = async (
  vorpal: CommandInstance
): Promise<string | null> => {
  const currentSubApp = await getCurrentSubApp();
  if (currentSubApp) {
    return currentSubApp.componentName;
  }
  const subApps = await getSubAppsInMonoRepo();
  if (subApps.length > 0) {
    const { subApp } = await vorpal.prompt({
      type: "list",
      name: "subApp",
      choices: subApps.map((a) => a.componentName),
      message: "Which subapp 🤔 ?",
    });
    return subApp;
  } else {
    return null;
  }
};
