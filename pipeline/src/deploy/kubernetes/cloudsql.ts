import type { Context} from "../..";
import { getSecretVarNameForContext } from "../..";

export const createCloudsqlBaseConfig = (context: Context) => {
  return {
    cloudsql: {
      proxyCredentials: `$${getSecretVarNameForContext(
        context,
        "cloudsqlProxyCredentials"
      )}`,
    },
  };
};
