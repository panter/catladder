import type Vorpal from "vorpal";

import { hasGitlabToken, setupGitlabToken } from "../../../utils/gitlab";

export const verify = async (vorpal: Vorpal) => {
  // check if has all settings

  if (!(await hasGitlabToken())) {
    vorpal.command("setup-gitlab-token").action(async function () {
      await setupGitlabToken(this);
    });
    vorpal.exec("setup-gitlab-token");
  }
};
