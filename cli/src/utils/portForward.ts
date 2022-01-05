import { spawn } from "child-process-promise";

const portForwards = new Map();

export const stopPortForward = async (name: string) => {
  const old = portForwards.get(name);

  if (old) {
    try {
      old.childProcess.kill();
      await old;
    } catch (e) {
      //
    }
    portForwards.delete(name);
  }
};

export const getAllRunningPortForwards = () => {
  return Array.from(portForwards.keys());
};
export const startPortForward = async (
  podname: string,
  localPort: number,
  remotePort: number,
  namespace: string
) => {
  const name = `${namespace}/${podname}/${localPort}:${remotePort}`;
  // stop if already there
  if (portForwards.has(name)) {
    stopPortForward(name);
  }
  const promise = spawn(
    "kubectl",
    ["port-forward", podname, `${localPort}:${remotePort}`, "-n", namespace],
    {
      env: {
        ...process.env,
        DEBUG: "",
      },
    }
  );
  portForwards.set(name, promise);
  // wait a moment so that is surley started, unfortunatly we don't know that
  await new Promise((r) => setTimeout(r, 1000));
};

export const stopAllPortForwards = async () => {
  getAllRunningPortForwards().forEach((name) => {
    stopPortForward(name);
  });
};
