import { startPortForwardCommand } from "../utils/portForwards";

export const startKubePortForward = async (
  podname: string,
  localPort: number,
  remotePort: number,
  namespace: string
) => {
  const name = `kube/${namespace}/${podname}/${localPort}:${remotePort}`;

  await startPortForwardCommand(
    name,
    `kubectl port-forward ${podname} ${localPort}:${remotePort} -n ${namespace}`
  );
};
