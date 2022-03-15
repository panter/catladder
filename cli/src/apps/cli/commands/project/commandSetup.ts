import {
  getFullKubernetesClusterName,
  isOfDeployType,
} from "@catladder/pipeline";
import Vorpal from "vorpal";
import { $ } from "zx";
import { getAllPipelineContexts } from "../../../../config/getProjectConfig";
import { connectToCluster } from "../../../../utils/cluster";
import {
  doGitlabRequest,
  getProjectInfo,
  upsertAllVariables,
} from "../../../../utils/gitlab";
import ensureNamespace from "./utils/ensureNamespace";
import open from "open";
import { projectConfigSecrets } from "./commandConfigSecrets";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-setup",
      "Initializes all environments and creates requires resources, service accounts, etc."
    )
    .action(async function () {
      const allContext = await getAllPipelineContexts();

      for (const context of allContext) {
        this.log("");
        this.log("=========================================");

        this.log(
          "setting up " +
            context.environment.shortName +
            ":" +
            context.componentName +
            "..."
        );
        this.log("");
        const deployConfig = context.componentConfig.deploy;
        if (isOfDeployType(deployConfig, "kubernetes")) {
          const fullName = getFullKubernetesClusterName(deployConfig.cluster);
          this.log(`cluster: ${fullName}`);

          await connectToCluster(fullName);
          this.log("");
          this.log("ensuring namespace ...");
          const namespace = await ensureNamespace(context);
          this.log("Namespace " + namespace + " created / updated!");
          this.log("");
          //$.verbose = true;

          // we name the service account and the role and the role binding with the same name
          // we currently create one per component to better separate them
          this.log("ensuring service accounts...");
          const serviceAccountName = `cl-${context.componentName}-deploy`;
          const KUBE_URL =
            await $`TERM=dumb kubectl cluster-info | grep -E 'Kubernetes master|Kubernetes control plane' | awk '/http/ {print $NF}'`.then(
              (s) => s.stdout.trim()
            );

          // first upsert service acount in the ns
          try {
            await $`kubectl delete serviceaccount --namespace ${namespace} ${serviceAccountName}`;
            await $`kubectl delete rolebinding --namespace ${namespace} ${serviceAccountName}`;
            await $`kubectl delete role --namespace ${namespace} ${serviceAccountName}`;
          } catch (e) {
            // ignore
          }

          await $`kubectl create serviceaccount --namespace ${namespace} ${serviceAccountName}`;

          // upsert role in the ns

          await $`cat <<EOF | kubectl apply -f -
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  namespace: ${namespace}
  name: ${serviceAccountName}
rules:
- apiGroups: ["", "extensions", "apps", "networking.k8s.io", "batch"]
  resources: ["deployments", "replicasets", "statefulsets", "pods", "secrets", "configmaps", "services", "ingresses", "serviceaccounts", "jobs", "cronjobs"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"] # You can also use ["*"]
---
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: ${serviceAccountName}
  namespace: ${namespace}
subjects:
  - kind: ServiceAccount
    name: ${serviceAccountName}
    namespace:  ${namespace}
roleRef:
  kind: Role
  name: ${serviceAccountName}
  apiGroup: rbac.authorization.k8s.io
EOF
            `;

          // get token name
          const tokenName =
            await $`kubectl get serviceaccount --namespace ${namespace} ${serviceAccountName} -o jsonpath='{.secrets[0].name}'`;

          const KUBE_CA_PEM =
            await $`kubectl get secret ${tokenName} --namespace ${namespace} -o jsonpath="{['data']['ca\\.crt']}"`.then(
              (c) => c.stdout.trim()
            );
          const KUBE_TOKEN =
            await $`kubectl get secret ${tokenName} --namespace ${namespace} -o jsonpath="{['data']['token']}" | base64 --decode`.then(
              (c) => c.stdout.trim()
            );

          const vars = {
            KUBE_TOKEN,
            KUBE_CA_PEM,
            KUBE_URL,
          };

          this.log("service accounts created / updated!");

          this.log("");
          this.log("pusing secrets to gitlab...");

          await upsertAllVariables(
            this,
            vars,
            context.environment.shortName,
            context.componentName
          );
          this.log("done!");
        }

        this.log("=========================================");
        this.log("");
      }

      const { id: projectId, web_url: projectWebUrl } = await getProjectInfo(
        this
      );
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
      this.log();
      const { configSecrets } = await this.prompt({
        default: true,
        message:
          "Before deployments work, you need to config secrets. Do it now?",
        name: "configSecrets",
        type: "confirm",
      });
      this.log();
      if (configSecrets) {
        await projectConfigSecrets(this);
      } else {
        this.log(
          "👆 don't forget to config secret using `project-config-secrets`"
        );
      }
      this.log();
      this.log("gitlab is ready! 🥂");
      this.log("\n");
      this.log("do not forget to make sure that:");
      [
        "you have __health route in place",
        "lint and test are defined",
        "secrets are configured (call project-config-secret)",
        "eat your vegetables",
        "be awesome 🤩",
      ].forEach((tip) => this.log(` - ${tip}`));
      this.log("\n");
      this.log("\n");
    });
