import { getAllEnvs, getAllEnvsInAllComponents } from "@catladder/pipeline";
import {
  getAllComponentsWithAllEnvs,
  getProjectConfig,
} from "../../../../../config/getProjectConfig";

export const allEnvs = async () => {
  const config = await getProjectConfig();
  if (!config) {
    return [];
  }
  return getAllEnvsInAllComponents(config);
};

export const envAndComponents = async () => {
  const allEnvAndcomponents = await getAllComponentsWithAllEnvs();

  return allEnvAndcomponents.reduce<string[]>(
    (acc, { env, componentName }) => [...acc, env + ":" + componentName],
    []
  );
};

export const allEnvsAndAllComponents = async () => {
  return [...(await allEnvs()), ...(await envAndComponents())];
};
