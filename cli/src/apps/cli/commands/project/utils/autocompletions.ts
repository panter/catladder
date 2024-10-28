import { getAllEnvs, getAllEnvsInAllComponents } from "@catladder/pipeline";
import {
  getAllComponentsWithAllEnvsFlat,
  getProjectConfig,
} from "../../../../../config/getProjectConfig";

export const allEnvs = async () => {
  const config = await getProjectConfig();
  if (!config) {
    return [];
  }
  return getAllEnvsInAllComponents(config);
};

export const allComponents = async () => {
  const config = await getProjectConfig();
  if (!config) {
    return [];
  }

  return Object.keys(config.components);
};

export const envAndComponents = async () => {
  const allEnvAndcomponents = await getAllComponentsWithAllEnvsFlat();

  return allEnvAndcomponents.reduce<string[]>(
    (acc, { env, componentName }) => [...acc, env + ":" + componentName],
    [],
  );
};

export const allEnvsAndAllComponents = async () => {
  return [...(await allEnvs()), ...(await envAndComponents())];
};
