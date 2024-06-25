import type { ComponentContext } from "@catladder/pipeline";
import {
  getFullKubernetesClusterName,
  isOfDeployType,
} from "@catladder/pipeline";
import type { CommandInstance } from "vorpal";
import { exec } from "child-process-promise";
import { connectToCluster } from "../../../../../utils/cluster";
import {
  doGitlabRequest,
  getProjectInfo,
  upsertAllVariables,
} from "../../../../../utils/gitlab";
import ensureNamespace from "../utils/ensureNamespace";

export const setupKubernetes = async (
  instance: CommandInstance,
  context: ComponentContext,
) => {
  const deployConfig = context.deploy?.config;
  if (!isOfDeployType(deployConfig, "kubernetes")) {
    throw new Error("cannot run setupKubernetes on non-kubernetes deployments");
  }

  const { id: projectId } = await getProjectInfo(instance);
  const deploy_tokens = await doGitlabRequest(
    instance,
    `projects/${projectId}/deploy_tokens`,
  );

  if (
    !deploy_tokens.find(
      (v: { name: string }) => v.name === "gitlab-deploy-token",
    )
  ) {
    instance.log(
      "I will setup the 'GitLab Deploy Token', so Kubernetes can pull images from this project.",
    );

    await doGitlabRequest(
      instance,
      `projects/${projectId}/deploy_tokens`,
      {
        id: projectId,
        name: "gitlab-deploy-token",
        scopes: ["read_registry"],
      },
      "POST",
    );
  }

  const fullName = getFullKubernetesClusterName(deployConfig.cluster);
  instance.log(`cluster: ${fullName}`);

  await connectToCluster(fullName);
  instance.log("");
  instance.log("ensuring namespace ...");
  const namespace = await ensureNamespace(context);
  instance.log("Namespace " + namespace + " created / updated!");
  instance.log("");
  //$.verbose = true;

  // we name the service account and the role and the role binding with the same name
  // we currently create one per component to better separate them
  instance.log("ensuring service accounts...");
  const serviceAccountName = `cl-${context.componentName}-deploy`;
  const KUBE_URL = await exec(
    `TERM=dumb kubectl cluster-info | grep -E 'Kubernetes master|Kubernetes control plane' | awk '/http/ {print $NF}'`,
  ).then((s) => s.stdout.trim());

  // first upsert service acount in the ns
  try {
    await exec(
      `kubectl delete serviceaccount --namespace ${namespace} ${serviceAccountName}`,
    );
    await exec(
      `kubectl delete rolebinding --namespace ${namespace} ${serviceAccountName}`,
    );
    await exec(
      `kubectl delete role --namespace ${namespace} ${serviceAccountName}`,
    );
  } catch (e) {
    // ignore
  }

  await exec(
    `kubectl create serviceaccount --namespace ${namespace} ${serviceAccountName}`,
  );

  // upsert role in the ns

  await exec(`cat <<EOF | kubectl apply -f -
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  namespace: ${namespace}
  name: ${serviceAccountName}
rules:
- apiGroups: ["", "extensions", "apps", "networking.k8s.io", "batch", "autoscaling", "rbac.authorization.k8s.io","snapshot.storage.k8s.io"]
  resources: ["deployments", "replicasets", "statefulsets", "pods", "secrets", "configmaps", "services", "ingresses", "serviceaccounts", "roles", "rolebindings", "jobs", "cronjobs", "horizontalpodautoscalers", "persistentvolumeclaims", "volumesnapshots"]
  verbs: ["*"]
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
`);

  const secretName = `${serviceAccountName}-secret`;
  // create token for the service account
  await exec(`
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: ${secretName}
  namespace: ${namespace}
  annotations:
    kubernetes.io/service-account.name: ${serviceAccountName}
type: kubernetes.io/service-account-token
EOF
  `);

  const KUBE_CA_PEM = await exec(
    `kubectl get secret ${secretName} --namespace ${namespace} -o jsonpath="{['data']['ca\\.crt']}"`,
  ).then((c) => c.stdout.trim());
  const KUBE_TOKEN = await exec(
    `kubectl get secret ${secretName} --namespace ${namespace} -o jsonpath="{['data']['token']}" | base64 --decode`,
  ).then((c) => c.stdout.trim());

  const vars = {
    KUBE_TOKEN,
    KUBE_CA_PEM,
    KUBE_URL,
  };

  const missing = Object.entries(vars).filter((e) => !e[1]);
  if (missing.length > 0) {
    throw new Error(
      "could not setup credentials. Missing vars: " +
        missing.map((m) => m[0]).join(", ") +
        ". Check whether your local kubectl is still working for '" +
        fullName +
        "'",
    );
  }

  instance.log("service accounts created / updated!");

  instance.log("");
  instance.log("pusing secrets to gitlab...");

  await upsertAllVariables(
    instance,
    vars,
    context.env,
    context.componentName,
    false, // no backup
  );
  instance.log("done!");
};
