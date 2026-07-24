import { spawn } from "child-process-promise";
import type { ReadStream } from "fs-extra";
import open from "open";

export type PortForward = Promise<unknown> & {
  childProcess: {
    stdout: ReadStream;
    kill: () => any;
  };
};
const portForwards = new Map<string, PortForward>();

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

const addPortForward = (name: string, portForward: PortForward) => {
  portForwards.set(name, portForward);
};

export const startPortForwardCommand = async (
  name: string,
  command: string,
) => {
  // stop if already there
  await stopPortForward(name);
  const [cmd, ...args] = command.split(" ");

  const promise = spawn(cmd, args, {
    env: {
      ...process.env,
      DEBUG: "",
    },
  }) as PortForward;
  addPortForward(name, promise);
  // wait a moment so that is surley started, unfortunatly we don't know that
  await new Promise((r) => setTimeout(r, 1000));
};
export const stopAllPortForwards = async () => {
  getAllRunningPortForwards().forEach((name) => {
    stopPortForward(name);
  });
};
