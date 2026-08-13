import { spawn } from "child-process-promise";

export const getShell = async (namespace: string, podName: string) => {
  const command = `kubectl exec -it ${podName} -n ${namespace} -- /bin/sh -xc 'bash||sh'`;
  try {
    await spawn(command, {
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        DEBUG: "",
      },
    });
  } catch (e) {
    // tslint:disable-next-line:no-console
    if (e.code !== 130) {
      console.log(e);
    }
  }
};
