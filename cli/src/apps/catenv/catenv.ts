import { ComponentConfig } from "@catladder/pipeline";
import { getEnvVars, getProjectConfig } from "../../config/getProjectConfig";
import { getGitRoot } from "../../utils/projects";
import { join } from "path";
const getCurrentComponentName = async (
  components: Record<string, ComponentConfig>
) => {
  const gitRoot = await getGitRoot();
  const currentDir = process.cwd();
  return Object.keys(components).find((c) =>
    currentDir.startsWith(join(gitRoot, components[c].dir))
  );
};

const sanitizeEnvVarName = (name: string) => name.replace(/[\s\-.]+/g, "_");
export default async () => {
  const { components } = getProjectConfig();

  const currentComponent = await getCurrentComponentName(components);
  let variables = {};
  if (currentComponent) {
    variables = await getEnvVars(null, "dev-local:" + currentComponent);
  } else {
    // when in a monorep and not in a subapp, merge all env vars.
    // this is not 100% correct, but better than not exporting any vars at all
    // so we also add prefixed variants
    variables = await Object.keys(components).reduce(
      async (acc, componentName) => {
        const subappvars = await getEnvVars(null, "dev-local:" + componentName);
        return {
          ...(await acc),
          ...subappvars,
          // also add prefixed variants in case
          ...Object.fromEntries(
            Object.entries(subappvars).map(([key, value]) => [
              `${sanitizeEnvVarName(componentName.toUpperCase())}_${key}`,
              value,
            ])
          ),
        };
      },
      {}
    );
  }

  console.log(
    Object.entries(variables)
      .map(([key, value]) => `export ${key}='${value}'`)
      .join("\n")
  );
};
