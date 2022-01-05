import { getAllEnvVars } from "../../utils/projects";
import {
  getCurrentSubApp,
  getSubAppsInMonoRepo,
} from "../shell/commands/project/utils/monorepo";

const sanitizeEnvVarName = (name: string) => name.replace(/[\s\-.]+/g, "_");
export default async () => {
  const subapps = await getSubAppsInMonoRepo();
  const currentSubApp = await getCurrentSubApp();
  let variables = {};
  if (currentSubApp) {
    variables = await getAllEnvVars("dev-local", currentSubApp.componentName);
  } else if (subapps.length > 0) {
    // when in a monorep and not in a subapp, merge all env vars.
    // this is not 100% correct, but better than not exporting any vars at all
    // so we also add prefixed variants
    variables = await subapps.reduce(async (acc, subapp) => {
      const subappvars = await getAllEnvVars("dev-local", subapp.componentName);
      return {
        ...(await acc),
        ...subappvars,
        // also add prefixed variants in case
        ...Object.fromEntries(
          Object.entries(subappvars).map(([key, value]) => [
            `${sanitizeEnvVarName(subapp.componentName.toUpperCase())}_${key}`,
            value,
          ])
        ),
      };
    }, {});
  } else {
    variables = await getAllEnvVars("dev-local");
  }

  console.log(
    Object.entries(variables)
      .map(([key, value]) => `export ${key}='${value}'`)
      .join("\n")
  );
};
