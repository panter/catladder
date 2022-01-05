import { existsSync, readdirSync } from "fs-extra";
import { join } from "path";
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
