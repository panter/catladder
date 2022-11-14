import type { EnvType } from "../types";
import { isKnowEnvType } from "../types";

export const getEnvType = (
  env: string,
  envConfig: {
    type?: EnvType;
  }
): EnvType => {
  if (envConfig.type) return envConfig.type;

  if (isKnowEnvType(env)) {
    return env;
  }

  throw new Error("unknown env type: " + env);
};
