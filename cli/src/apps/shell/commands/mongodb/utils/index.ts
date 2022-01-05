import { exec, spawn } from "child-process-promise";
import { Env } from "../../../../../types/types";
import {
  getProjectNamespace,
  getProjectPodNames,
} from "../../../../../utils/projects";

const filterMongoDbs = (podNames: string[]) =>
  podNames.filter((name) => name.includes("mongodb-replicaset"));

export const getProjectMongodbAllPods = async (env: Env) =>
  filterMongoDbs(await getProjectPodNames(env));

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
  const result = await executeMongodbCommand(
    namespace,
    podName,
    "db.isMaster()"
  );

  return result.ismaster;
};

const spaces = (n: number) => " ".repeat(n);

export const getMongoDbPodsWithReplInfo = async (env: Env) => {
  const namespace = await getProjectNamespace(env);
  return (
    await Promise.all(
      (
        await getProjectMongodbAllPods(env)
      ).map(async (podName) => ({
        podName,
        componentName: podName.replace(/-mongodb-replicaset-[0-9]+/, ""),
        isMaster: await podIsMaster(namespace, podName),
      }))
    )
  ).sort((podA, podB) => (podA.isMaster ? (podB.isMaster ? 0 : -1) : 1));
};

export const getProjectMongodbAllPodsSortedWithLabel = async (env: Env) => {
  const pods = await getMongoDbPodsWithReplInfo(env);
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
