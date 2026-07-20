import type { IO } from "../../../../../core/types";
import { add, format } from "date-fns";
import {
  doGitlabRequest,
  doGitlabRequestAllPages,
  getProjectInfo,
} from "../../../../../utils/gitlab";

const TOKEN_NAME = "semantic-release";

export const setupAccessTokens = async (instance: IO) => {
  const { id: projectId } = await getProjectInfo(instance);

  // all pages: rotated tokens accumulate one (inactive) entry per
  // rotation, so the active one quickly moves past the first page —
  // missing it here created a brand-new duplicate token on every setup
  const projectTokens = await doGitlabRequestAllPages(
    instance,
    `projects/${projectId}/access_tokens`,
  );
  const token = projectTokens.find(
    (t) => t.name === TOKEN_NAME && t.active === true,
  );

  const expires_at = format(
    add(new Date(), { years: 1, days: -1 }),
    "yyyy-MM-dd",
  );

  const newToken = token
    ? await doGitlabRequest(
        instance,
        `projects/${projectId}/access_tokens/${token.id}/rotate`,
        { expires_at },
        "POST",
      )
    : await doGitlabRequest(
        instance,
        `projects/${projectId}/access_tokens`,
        {
          name: TOKEN_NAME,
          scopes: ["api", "read_repository"],
          access_level: 40, // Maintainer
          expires_at,
        },
        "POST",
      );

  try {
    await doGitlabRequest(instance, `projects/${projectId}/variables/GL_TOKEN`);
    await doGitlabRequest(
      instance,
      `projects/${projectId}/variables/GL_TOKEN`,
      { value: newToken.token },
      "PUT",
    );
  } catch (e) {
    if (e.message !== "not found") {
      throw e;
    }
    // not found
    await doGitlabRequest(
      instance,
      `projects/${projectId}/variables`,
      {
        key: "GL_TOKEN",
        value: newToken.token,
        masked: true,
      },
      "POST",
    );
  }

  instance.log(
    "Token configured for semantic release. Renew me again in a year!",
  );
};
