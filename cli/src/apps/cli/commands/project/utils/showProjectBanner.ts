import type Vorpal from "vorpal";
import { getProjectConfig } from "../../../../../config/getProjectConfig";

export const showProjectBanner = async (vorpal: Vorpal) => {
  const projectConfig = await getProjectConfig();
  if (projectConfig) {
    vorpal.log("project: " + projectConfig.appName);
    vorpal.log("customer: " + projectConfig.customerName);
    vorpal.log("");
  }
};
