import { spawn } from "child-process-promise";
import type Vorpal from "vorpal";

const createProxy = async (instance: string, port: number) => {
  const proxy = spawn(
    `cloud_sql_proxy -instances ${instance}=tcp:${port}`,
    [],
    { shell: "bash" }
  );
  // wait until it starts
  await spawn(
    `echo -n "Waiting for proxy"
      until echo > /dev/tcp/localhost/${port}; do
        sleep 0.2
        echo -n "."
      done 2>/dev/null`,
    [],
    { shell: "bash" }
  );
  const stop = () => proxy.childProcess.kill();
  process.on("beforeExit", stop);

  return {
    stop,
  };
};

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "cloud-sql-restore-db",
      "restore a db from one source to another target"
    )
    .action(async function restoreDb() {
      const { sourceInstance } = await this.prompt({
        type: "input",
        name: "sourceInstance",

        message: "Source instance (connection string or 'local')? 🤔 ",
      });

      let sourceProxy: { stop: () => void };

      let targetProxy: { stop: () => void };

      let sourcePort: number;
      let targetPort: number;

      if (sourceInstance === "local") {
        const { sourceLocalPort } = await this.prompt({
          type: "number",
          name: "sourceLocalPort",
          default: 5432,

          message: "Local Port for source? 🤔 ",
        });
        sourcePort = sourceLocalPort;
      } else {
        sourcePort = 54399;
        sourceProxy = await createProxy(sourceInstance, sourcePort);
      }

      const { sourceUsername } = await this.prompt({
        type: "input",
        name: "sourceUsername",
        default: "postgres",

        message: "Source Username? 🤔 ",
      });

      const { sourcePassword } = await this.prompt({
        type: "input",
        name: "sourcePassword",

        message: "Source Password? 🤔 ",
      });

      const { sourceDbName } = await this.prompt({
        type: "input",
        name: "sourceDbName",

        message: "Source DB name? 🤔 ",
      });

      const { targetInstance } = await this.prompt({
        type: "input",
        name: "targetInstance",

        message: "Targe INSTANCE (connection string or 'local')? 🤔  ",
      });

      if (targetInstance === "local") {
        const { targetLocalPort } = await this.prompt({
          type: "number",
          name: "targetLocalPort",
          default: 5432,

          message: "Local Port for target? 🤔 ",
        });
        targetPort = targetLocalPort;
      } else {
        targetPort = 54499;
        targetProxy = await createProxy(targetInstance, targetPort);
      }

      const { targetUsername } = await this.prompt({
        type: "input",
        name: "targetUsername",
        default: "postgres",

        message: "Target Username? 🤔 ",
      });
      const { targetPassword } = await this.prompt({
        type: "input",
        name: "targetPassword",

        message: "Target Password? 🤔 ",
      });

      const { targetDbName } = await this.prompt({
        type: "input",
        name: "targetDbName",

        message: "Target DB name? 🤔 ",
      });

      const { shouldContinue } = await this.prompt({
        type: "confirm",
        name: "shouldContinue",
        message: `This will drop ${targetInstance}/${targetDbName} and replace it with ${sourceInstance}/${sourceDbName}. Continue? 🤔 `,
      });

      if (!shouldContinue) {
        return;
      }

      const targetPSQL = (command: string) =>
        `PGPASSWORD=${targetPassword} psql -p ${targetPort} --host=localhost --user=${targetUsername} -q ${command}`;

      const copyDBScript = `
      set -e
     
    

      dumptmp=$(mktemp /tmp/dump.XXXXXX)

      echo "Dumping file to $dumptmp"
      pg_dump --dbname=postgres://${sourceUsername}:${sourcePassword}@localhost:${sourcePort}/${sourceDbName} --no-owner --no-privileges > $dumptmp
      echo "dump done"
      ${targetPSQL(
        `-c 'drop database "${targetDbName}" WITH (FORCE)' 1> /dev/null || true`
      )}
      ${targetPSQL(`-c 'create database "${targetDbName}"' 1> /dev/null`)}
          echo "Restoring dump..."
      ${targetPSQL(`"${targetDbName}" < $dumptmp 1> /dev/null`)}
  

      echo "Clean up..."
      set +e
      rm $dumptmp
      echo "\n🐱 Done!"
      `;
      try {
        await spawn(copyDBScript, [], { shell: "bash", stdio: "inherit" });
      } finally {
        sourceProxy?.stop();
        targetProxy?.stop();
      }
    });
