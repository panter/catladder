import open from "open";
import { CommandInstance } from "vorpal";
import { doGitlabRequest, getProjectInfo } from "../../../../../utils/gitlab";

export const setupAccessTokens = async (instance: CommandInstance) => {
  const { id: projectId, web_url: projectWebUrl } = await getProjectInfo(
    instance
  );
  try {
    await doGitlabRequest(instance, `projects/${projectId}/variables/GL_TOKEN`);
  } catch (e) {
    if (e.message !== "not found") {
      throw e;
    }
    // not found

    instance.log(
      "I need add a GL_TOKEN to the project, so that semantic release will work\n"
    );
    instance.log(
      "👉 Please please create a project access token in gitlab and copy its value into clipboard\n\n - name: something like 'semantic-release'\n - expires: leave empty\n - scopes: api, read_repository"
    );
    instance.log("\n");

    const { understood } = await instance.prompt({
      default: true,
      message: "Understood and open gitlab now? 🤔",
      name: "understood",
      type: "confirm",
    });
    if (!understood) {
      instance.log("continuing anyway...");
    }
    open(`${projectWebUrl}/-/settings/access_tokens`);

    instance.log("\n");

    instance.log("Enter your copied token now: ");

    instance.log("\n");
    const { GL_TOKEN } = await instance.prompt({
      type: "password",
      name: "GL_TOKEN",
      message: "Access Token: ",
    });
    await doGitlabRequest(instance, `projects/${projectId}/variables`, {
      key: "GL_TOKEN",
      value: GL_TOKEN,
      masked: true,
    });
  }

  const deploy_tokens = await doGitlabRequest(
    instance,
    `projects/${projectId}/deploy_tokens`
  );

  if (
    !deploy_tokens.find(
      (v: { name: string }) => v.name === "gitlab-deploy-token"
    )
  ) {
    instance.log(
      "I will setup the 'GitLab Deploy Token', so Kubernetes can pull images from this project."
    );

    await doGitlabRequest(instance, `projects/${projectId}/deploy_tokens`, {
      id: projectId,
      name: "gitlab-deploy-token",
      scopes: ["read_registry"],
    });
  }
};
