import { exec, spawn } from "child-process-promise";
import { getProjectPodNames } from "../../../../../kubernetes";
import { getProjectNamespace } from "../../../../../utils/projects";

const filterMongoDbs = (podNames: string[]) =>
  podNames.filter(
    (name) =>
      name.includes("mongodb") &&
      !name.includes("mongodb-backup") &&
      !name.includes("arbiter")
  );

export const getProjectMongodbAllPods = async (envComponent: string) =>
  filterMongoDbs(await getProjectPodNames(envComponent));

export const getMongodbShell = async (namespace: string, podName: string) => {
  const command = `kubectl exec -it ${podName} --namespace ${namespace} mongo`;
  try {
    await spawn(command, {
      shell: true,
      stdio: "inherit",
      env: {
        ...process.env,
        DEBUG: "",
      },
    });
  } catch (e) {
    //
  }
};

export const executeMongodbCommand = async (
  namespace: string,
  podName: string,
  mongoCommand: string
) => {
  const fullCommand = `kubectl exec -it ${podName} --namespace ${namespace} -- mongo --quiet --eval "JSON.stringify(${mongoCommand})"`;
  const { stdout } = await exec(fullCommand, {
    env: {
      ...process.env,
      DEBUG: "",
    },
  });

  return JSON.parse(stdout);
};

export const podIsMaster = async (namespace: string, podName: string) => {
  try {
    const result = await executeMongodbCommand(
      namespace,
      podName,
      "db.isMaster()"
    );

    return result.ismaster;
  } catch (e) {
    // maybe shutting down ?
    return null;
  }
};

const spaces = (n: number) => " ".repeat(n);

export const getMongoDbPodsWithReplInfo = async (envComponent: string) => {
  const namespace = await getProjectNamespace(envComponent);
  return (
    await Promise.all(
      (
        await getProjectMongodbAllPods(envComponent)
      ).map(async (podName) => ({
        podName,
        componentName: podName.replace(/-mongodb-replicaset-[0-9]+/, ""),
        isMaster: await podIsMaster(namespace, podName),
      }))
    )
  ).sort((podA, podB) => (podA.isMaster ? (podB.isMaster ? 0 : -1) : 1));
};

export const getProjectMongodbAllPodsSortedWithLabel = async (
  envComponent: string
) => {
  const pods = await getMongoDbPodsWithReplInfo(envComponent);
  const maxComponentNameLength = Math.max(
    ...pods.map((c) => c.componentName.length)
  );
  return pods.map(({ podName, isMaster, componentName }) => ({
    value: podName,
    name: `[ ${componentName}${spaces(
      maxComponentNameLength - componentName.length
    )} ${isMaster ? "  PRIMARY  " : " secondary "}] ${podName}`,
  }));
};
