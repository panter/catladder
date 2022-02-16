import {
  getFullKubernetesClusterName,
  isOfDeployType,
  getKubernetesNamespace,
} from "@catladder/pipeline";
import Vorpal from "vorpal";
import { $ } from "zx";
import { getAllPipelineContexts } from "../../../../config/getProjectConfig";
import { connectToCluster } from "../../../../utils/cluster";
import { upsertAllVariables } from "../../../../utils/gitlab";
import ensureNamespace from "./utils/ensureNamespace";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-init-gitlab",
      "Initializes the gitlab repo, e.g. connects the cluster to it"
    )
    .action(async function () {
      const allContext = await getAllPipelineContexts();

      for (const context of allContext) {
        const deployConfig = context.componentConfig.deploy;
        if (isOfDeployType(deployConfig, "kubernetes")) {
          const fullName = getFullKubernetesClusterName(deployConfig.cluster);
          this.log(
            `connecting ${context.environment.shortName}:${context.componentName} ${fullName}`
          );

          await connectToCluster(fullName);

          const namespace = await ensureNamespace(context);

          //$.verbose = true;

          // we name the service account and the role and the role binding with the same name
          // we currently create one per component to better separate them
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

          await upsertAllVariables(
            this,
            vars,
            context.environment.shortName,
            context.componentName
          );
        }
      }

      // there is a constraint, see https://git.panter.ch/catladder/catladder/-/issues/2#note_345677
      // any two components have to use the same custer per env, so e.g. dev:api and dev:www cannot use two different namespaces
      // in practise, that is often not an issue, but it might happen because the config allows it
      /*
      Object.entries(configuredClusters).forEach(([fullname, config]) =>
        this.log(` - ${config.cluster.name || "unknown"} (${fullname})`)
      );
      this.log("");

      const missingClusters = Object.fromEntries(
        Object.entries(configuredClusters).filter(
          ([c]) => !existingClusters.some((exist) => exist === c)
        )
      );

      this.log("");
      this.log("These clusters are not configured yet on gitlab:");
      this.log("");

      Object.entries(missingClusters).forEach(([fullname, config]) =>
        this.log(` - ${config.cluster.name || "unknown"} (${fullname})`)
      );
      this.log("");

      for (const [fullname, config] of Object.entries(missingClusters)) {
        this.log(`${config.name} (${fullname})`);
        this.log("");
        const { shouldContinue } = await this.prompt({
          type: "confirm",
          name: "shouldContinue",
          message: "Should I add the this cluster ? 🤔  ",
        });
        this.log("");
        if (shouldContinue) {
          await connectToCluster(fullname);
          const { stdout: api_url } =
            await $`kubectl cluster-info | grep -E 'Kubernetes master|Kubernetes control plane' | awk '/http/ {print $NF}'`;
          const { stdout: ca_cert } =
            await $`kubectl get secret default-token-69xv4 -o jsonpath="{['data']['ca\.crt']}" | base64 --decode`;
          const { stdout: token } =
            await $`kubectl get secret default-token-69xv4 -o jsonpath="{['data']['token']}" | base64 --decode`;
          const postResult = await doGitlabRequest(
            this,
            `projects/${projectId}/clusters/user`,
            {
              name: fullname,
              managed: false,
              environment_scope: "*",
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
      */
    });
