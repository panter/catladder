import type { DeployConfigCloudRunProbeShared } from "../../types";
import {
  defaultLivenessProbe,
  defaultStartupProbe,
  type DeployConfigCloudRunProbe,
  type DeployConfigCloudRunService,
} from "../../types";

const PORT = 8080;

export function healthCheckCliArgs(
  healthCheck: DeployConfigCloudRunService["healthCheck"],
) {
  const shouldNotSetHealthCheck = healthCheck === undefined;
  if (shouldNotSetHealthCheck) {
    return undefined;
  }

  const shouldUseDefaultProbe = healthCheck === true;

  if (shouldUseDefaultProbe) {
    return {
      "startup-probe": toArgValue(probeToKeyValuePairs(defaultStartupProbe)),
      "liveness-probe": toArgValue(probeToKeyValuePairs(defaultLivenessProbe)),
    };
  }

  return {
    "startup-probe": toArgValue(probeToKeyValuePairs(healthCheck.startupProbe)),
    "liveness-probe": healthCheck.livenessProbe
      ? toArgValue(probeToKeyValuePairs(healthCheck.livenessProbe))
      : "", // NOTE: empty string ("") removes liveness probe
  };
}

function probeToKeyValuePairs(
  probe: DeployConfigCloudRunProbe,
): [string, unknown][] {
  const sharedArgs = Object.entries({
    initialDelaySeconds: probe.initialDelaySeconds,
    timeoutSeconds: probe.timeoutSeconds,
    periodSeconds: probe.periodSeconds,
    failureThreshold: probe.failureThreshold,
  } satisfies DeployConfigCloudRunProbeShared);

  switch (probe.type) {
    case "tcp":
      return [...sharedArgs, ["tcpSocket.port", PORT]];
    case "http1":
      return [
        ...sharedArgs,
        ["httpGet.port", PORT],
        ["httpGet.path", probe.path],
        // NOTE: headers are not supported by "gcloud beta" at the moment
      ];
    default:
      probe satisfies never;
      return [];
  }
}

function toArgValue(keyValues: [string, unknown][]) {
  return keyValues.map(([key, value]) => `${key}=${value}`).join(",");
}
