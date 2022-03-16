import {
  Context,
  getFullKubernetesClusterName,
  isOfDeployType,
} from "@catladder/pipeline";
import { CommandInstance } from "vorpal";
import { $ } from "zx";
import { connectToCluster } from "../../../../../utils/cluster";
import { upsertAllVariables } from "../../../../../utils/gitlab";
import ensureNamespace from "../utils/ensureNamespace";

export const setupKubernetes = async (
  instance: CommandInstance,
  context: Context
) => {
  const deployConfig = context.componentConfig.deploy;
  if (!isOfDeployType(deployConfig, "kubernetes")) {
    throw new Error("cannot run setupKubernetes on non-kubernetes deployments");
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

  instance.log("service accounts created / updated!");

  instance.log("");
  instance.log("pusing secrets to gitlab...");

  await upsertAllVariables(
    instance,
    vars,
    context.environment.shortName,
    context.componentName
  );
  instance.log("done!");
};
