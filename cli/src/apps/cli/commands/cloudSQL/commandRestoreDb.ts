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

        message: "Source instance (connection string)? 🤔 ",
      });

      const SOURCE_INSTANCE_PORT = 54399;
      const TARGET_INSTANCE_PORT = 54499;

      const sourceProxy = await createProxy(
        sourceInstance,
        SOURCE_INSTANCE_PORT
      );

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

        message: "Targe INSTANCE (connection string)? 🤔  ",
      });

      const targetProxy = await createProxy(
        targetInstance,
        TARGET_INSTANCE_PORT
      );

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
        `PGPASSWORD=${targetPassword} psql -p ${TARGET_INSTANCE_PORT} --host=localhost --user=postgres -q ${command}`;

      const copyDBScript = `
      set -e
     
    

      dumptmp=$(mktemp /tmp/dump.XXXXXX)

      echo "Dumping file to $dumptmp"
      pg_dump --dbname=postgres://postgres:${sourcePassword}@localhost:${SOURCE_INSTANCE_PORT}/${sourceDbName} --no-owner --no-privileges > $dumptmp
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
        sourceProxy.stop();
        targetProxy.stop();
      }
    });
