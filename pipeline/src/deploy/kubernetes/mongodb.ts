import { range } from "lodash";
import type { Context } from "../..";
import { getSecretVarNameForContext, isOfDeployType } from "../..";

const getCredentialString = (context: Context) =>
  `root:$${getSecretVarNameForContext(context, "MONGODB_ROOT_PASSWORD")}@`;
const getMongodbHost = (context: Context, name: string) => {
  const namespace = context.environment.envVars.KUBE_NAMESPACE;
  return `${name}.${namespace}.svc.cluster.local:27017`;
};

const getMongodbStandaloneHost = (context: Context) => {
  const fullAppname = context.environment.envVars.KUBE_APP_NAME;
  return getMongodbHost(context, `${fullAppname}-mongodb`);
};

const getMongodbReplicasetHost = (context: Context, index: number) => {
  const fullAppname = context.environment.envVars.KUBE_APP_NAME;
  return getMongodbHost(
    context,
    `${fullAppname}-mongodb-${index}.${fullAppname}-mongodb-headless`
  );
};
const createMongodbUrl = (context: Context, dbName: string) => {
  if (!isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
    throw new Error("can only createMongodbUrl on supported deploys");
  }
  const mongodbConfig = context.componentConfig.deploy.values?.mongodb;

  let queryParams: string | undefined = undefined;

  let hosts = "";
  if (mongodbConfig?.architecture === "replicaset") {
    hosts = range(0, mongodbConfig?.replicaCount ?? 2)
      .map((i) => getMongodbReplicasetHost(context, i))
      .join(",");

    queryParams = "replicaSet=rs0&authSource=admin";
  } else {
    hosts = getMongodbStandaloneHost(context);
    queryParams = "authSource=admin";
  }

  return `mongodb://${getCredentialString(context)}${hosts}/${dbName}${
    queryParams ? `?${queryParams}` : ""
  }`;
};
const createMongoBackupDefaultConfig = (context: Context) => {
  if (!isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
    throw new Error("can only create mongodb base config on supported deploys");
  }
  const mongodbConfig = context.componentConfig.deploy.values?.mongodb;
  const fullAppName = context.environment.envVars.KUBE_APP_NAME;
  const backupEnabled = ["prod", "stage"].includes(context.environment.envType);

  let hostToBackup: string;
  let pvcToBackup: string;

  if (mongodbConfig?.architecture === "replicaset") {
    // bit quirky, we need to specify the host and its volume
    // on replicaset its probably best to not use the first one, whcih usually starts as master, so we take the second (last one would also be ok)
    const backupHostIndex =
      mongodbConfig?.architecture === "replicaset" &&
      mongodbConfig.replicaCount &&
      mongodbConfig.replicaCount > 1
        ? 1
        : 0;

    hostToBackup = getMongodbReplicasetHost(context, backupHostIndex);
    pvcToBackup = `datadir-${fullAppName}-mongodb-${backupHostIndex}`;
  } else {
    hostToBackup = getMongodbStandaloneHost(context);
    pvcToBackup = `${fullAppName}-mongodb`;
  }

  return {
    enabled: backupEnabled,
    hostToBackup,
    pvcToBackup,
    image: "mrelite/kubectlmongoshell:v1.0",
    schedule: "0 4 * * *",
    volumeSnapshotClass: "snapshotclass",
  };
};
export const createMongodbBaseConfig = (context: Context) => {
  if (!isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
    throw new Error("can only create mongodb base config on supported deploys");
  }
  const mongodbConfig = context.componentConfig.deploy.values?.mongodb;

  return {
    mongodb: {
      enabled: true,
      auth: {
        enabled: true,
        rootPassword:
          "$" + getSecretVarNameForContext(context, "MONGODB_ROOT_PASSWORD"),
        replicaSetKey:
          "$" + getSecretVarNameForContext(context, "MONGODB_REPLICASET_KEY"),
      },
      persistence: {
        storageClass: "standard-rwo",
      },
      backup: createMongoBackupDefaultConfig(context),
    },
    env: {
      secret: {
        MONGO_URL: createMongodbUrl(context, mongodbConfig?.dbName ?? "app"),
        ...(mongodbConfig?.architecture === "replicaset"
          ? { MONGO_OPLOG_URL: createMongodbUrl(context, "local") } // oplog only works with replicasets
          : {}),
      },
    },
  };
};
