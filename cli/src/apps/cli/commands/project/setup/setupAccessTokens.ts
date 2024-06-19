import type { CommandInstance } from "vorpal";
import { doGitlabRequest, getProjectInfo } from "../../../../../utils/gitlab";

const TOKEN_NAME = "semantic-release";

export const setupAccessTokens = async (instance: CommandInstance) => {
  const { id: projectId } = await getProjectInfo(instance);

  const projectTokens = await doGitlabRequest(
    instance,
    `projects/${projectId}/access_tokens`,
  );
  const token = projectTokens.find(
    (t) => t.name === TOKEN_NAME && t.active === true,
  );
  const expires_at = new Date(Date.now() + (365 - 1) * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

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
