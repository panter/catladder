import { spawn } from "child-process-promise";
import commandExists from "command-exists-promise";

export const ERROR_NOT_INSTALLED = "cloud-sql-proxy not installed";

export type CloudSqlBackgroundProxy = {
  stop: () => void;
};

export type CloudSqlProxyOptions = {
  instanceName: string;
  localPort: number;
};

const getProxyCommandSpawnArgs = async ({
  localPort,
  instanceName,
}: CloudSqlProxyOptions) => {
  const commandString = (await commandExists("cloud-sql-proxy"))
    ? `cloud-sql-proxy --port ${localPort} ${instanceName}`
    : (await commandExists(
        "cloud_sql_proxy" // v1
      ))
    ? `cloud_sql_proxy -instances ${instanceName}=tcp:${localPort}`
    : null;
  if (!commandString) {
    throw new Error(ERROR_NOT_INSTALLED);
  }

  const [cmd, ...args] = commandString.split(" ");
  return { cmd, args };
};

export const startCloudSqlProxyInCurrentShell = async (
  opts: CloudSqlProxyOptions
) => {
  const { cmd, args } = await getProxyCommandSpawnArgs(opts);

  await spawn(cmd, args, {
    stdio: "inherit",
    shell: true,
  });
};

export const startCloudSqlProxyInBackground = async (
  opts: CloudSqlProxyOptions
): Promise<CloudSqlBackgroundProxy> => {
  const { cmd, args } = await getProxyCommandSpawnArgs(opts);

  const proxyPromise = spawn(cmd, args, { shell: "bash" });

  // wait until it starts
  await spawn(
    `echo -n "Waiting for proxy"
      until echo > /dev/tcp/localhost/${opts.localPort}; do
        sleep 0.2
        echo -n "."
      done 2>/dev/null`,
    [],
    { shell: "bash" }
  );
  const stop = () => {
    proxyPromise.catch(() => {
      // ignore
    });
    proxyPromise.childProcess.kill();
  };
  // stop if catladder i stopped
  process.on("beforeExit", stop);

  return {
    stop,
  };
};
