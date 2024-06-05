import { omit } from "lodash";
import type { DeployConfigKubernetesValues } from "../types";
import type { StringOrBashExpression } from "../../bash/BashExpression";

export const processSecretsAsFiles = <
  T extends {
    env: {
      secret: Record<string, StringOrBashExpression>;
    };
  } & DeployConfigKubernetesValues
>(
  values: T
): T => {
  if (!values.secretsAsFile || values.secretsAsFile.length === 0) {
    return values;
  }
  // the initial idea was that we "shadow" secrets that we mount as files,
  // but there is a weird kubernetes  issue with that (https://github.com/kubernetes/kubernetes/issues/46861),
  // so instead we rename the secrets and append _content, so that inside kuberentes, we can use the original name to contain the path and name+_content as the actual content
  return {
    ...values,
    env: {
      ...values.env,
      secret: {
        ...omit(values.env.secret, values.secretsAsFile),
        ...Object.fromEntries(
          values.secretsAsFile.map((key) => [
            key + "_content",
            values.env.secret[key],
          ])
        ),
      },
    },
  };
};
