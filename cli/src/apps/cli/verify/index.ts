import Vorpal from "vorpal";
import {
  getGitlabCi,
  getProjectConfig,
} from "../../../config/getProjectConfig";
import { hasGitlabToken, setupGitlabToken } from "../../../utils/gitlab";
import { migrateV2 } from "./migration/fromv2";

export const verify = async (vorpal: Vorpal) => {
  // check if has all settings

  if (!(await hasGitlabToken())) {
    vorpal.command("setup-gitlab-token").action(async function () {
      await setupGitlabToken(this);
    });
    vorpal.exec("setup-gitlab-token");
  }

  const projectConfig = await getProjectConfig();
  try {
    const gitlabCi = getGitlabCi();

    if (!gitlabCi) {
      vorpal.log("not initialized");
    }

    if (!projectConfig) {
      vorpal.log("no project config, needs migration");
      await migrateV2(vorpal);
    }
  } catch (e) {
    // no gitroot, ignore
  }
};
