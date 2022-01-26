import { Context } from "../..";

export const createMongodbBaseConfig = (context: Context) => {
  return {
    mongodb: {
      enabled: true,
      backup: {
        enabled: ["prod", "stage"].includes(context.environment.envType),
      },
    },
    "mongodb-replicaset": {
      replicas: 1,
      persistentVolume: {
        storageClass: ["prod", "stage"].includes(context.environment.envType)
          ? "fast"
          : "standard",
      },
    },
  };
};
