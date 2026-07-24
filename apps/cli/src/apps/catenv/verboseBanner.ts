import {
  getEnvironment,
  getProjectConfig,
} from "../../config/getProjectConfig";

export const printVerboseBanner = async () => {
  const config = await getProjectConfig();
  if (!config) {
    return;
  }

  const allCompontsWithPorts = await Promise.all(
    Object.keys(config.components).map(async (componentName) => {
      const environment = await getEnvironment("local", componentName);
      const port = environment.envVars.PORT;
      if (!port) {
        return null;
      }
      return `${componentName}: http://localhost:${port}`;
    }),
  ).then((lines) => lines.filter(Boolean));

  const lines = [
    "catenv",
    "-------",
    "running on:",
    "",
    ...allCompontsWithPorts,
  ];
  for (const line of lines) {
    console.log(line);
  }
};
