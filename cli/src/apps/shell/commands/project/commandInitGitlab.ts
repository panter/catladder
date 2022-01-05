import open from "open";
import Vorpal from "vorpal";
import { getClusterByName } from "../../../../utils/cluster";
import { doGitlabRequest, getProjectInfo } from "../../../../utils/gitlab";
import { readPass, syncBitwarden } from "../../../../utils/passwordstore/";
import {
  getLocalProjectVariables,
  getProjectNamespace,
} from "../../../../utils/projects";

export default (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-init-gitlab",
      "Initializes the gitlab repo, e.g. connects the cluster to it"
    )
    .action(async function () {
      const { id: projectId, web_url: projectWebUrl } = await getProjectInfo(
        this
      );
      await syncBitwarden();
      const clusters = await doGitlabRequest(
        this,
        `projects/${projectId}/clusters`
      );

      if (clusters.length === 0) {
        this.log("");
        this.log("there is no cluster on the current project?");
      } else {
        this.log("there are already these clusters on the gitlab: ");
        this.log("");
        clusters.forEach((cluster: any) => this.log(` - ${cluster.name}`));
      }

      this.log("");
      this.log("your project specifies the following cluster:");
      this.log("");
      const { CLUSTER_NAME } = await getLocalProjectVariables();
      const configuredCluster = await getClusterByName(CLUSTER_NAME);
      if (!configuredCluster) {
        throw new Error(
          `there exist no cluster with the name '${CLUSTER_NAME}'`
        );
      }
      this.log(`${CLUSTER_NAME} (${configuredCluster.fullName})`);
      this.log("");
      const { shouldContinue } = await this.prompt({
        type: "confirm",
        name: "shouldContinue",
        message: "Should I add the this cluster ? 🤔  ",
      });
      this.log("");
      if (shouldContinue) {
        const { api_url, passCredentials } = configuredCluster;
        if (!api_url) {
          throw new Error("no api_url on this cluster!");
        }
        if (!passCredentials) {
          throw new Error("no passCredentials on this cluster!");
        }
        const token = await readPass(passCredentials.token);
        const ca_cert = await readPass(passCredentials.ca_cert);

        const postResult = await doGitlabRequest(
          this,
          `projects/${projectId}/clusters/user`,
          {
            name: configuredCluster.fullName,
            managed: false,
            platform_kubernetes_attributes: {
              api_url,
              ca_cert,
              token,
              namespace: await getProjectNamespace("prod"),
            },
          }
        );
        const { message } = postResult;
        if (message) {
          this.log(`Message from gitlab: ${message}`);
        }
      }

      const variables = await doGitlabRequest(
        this,
        `projects/${projectId}/variables`
      );

      if (!variables.find((v: any) => v.key === "GL_TOKEN")) {
        this.log(
          "I need add a GL_TOKEN to the project, so that semantic release will work\n"
        );
        this.log(
          "👉 Please please create a project access token in gitlab and copy its value into clipboard\n\n - name: something like 'semantic-release'\n - expires: leave empty\n - scopes: api, read_repository"
        );
        this.log("\n");

        const { understood } = await this.prompt({
          default: true,
          message: "Understood and open gitlab now? 🤔",
          name: "understood",
          type: "confirm",
        });
        if (!understood) {
          this.log("continuing anyway...");
        }
        open(`${projectWebUrl}/-/settings/access_tokens`);

        this.log("\n");

        this.log("Enter your copied token now: ");

        this.log("\n");
        const { GL_TOKEN } = await this.prompt({
          type: "password",
          name: "GL_TOKEN",
          message: "Access Token: ",
        });
        await doGitlabRequest(this, `projects/${projectId}/variables`, {
          key: "GL_TOKEN",
          value: GL_TOKEN,
        });
      }

      const deploy_tokens = await doGitlabRequest(
        this,
        `projects/${projectId}/deploy_tokens`
      );

      if (
        !deploy_tokens.find(
          (v: { name: string }) => v.name === "gitlab-deploy-token"
        )
      ) {
        this.log(
          "I will setup the 'GitLab Deploy Token', so Kubernetes can pull images from this project."
        );

        await doGitlabRequest(this, `projects/${projectId}/deploy_tokens`, {
          id: projectId,
          name: "gitlab-deploy-token",
          scopes: ["read_registry"],
        });
      }
      this.log("gitlab is ready! 🥂");
      this.log("\n");
      this.log("do not forget to make sure that:");
      [
        "you have __health route in place",
        "lint and test are defined",
        "eat your vegetables",
        "be awesome 🤩",
      ].forEach((tip) => this.log(` - ${tip}`));
      this.log("\n");
      this.log("\n");
    });
