import { spawn } from "child-process-promise";
type Opts = {
  targetPassword: string;
  targetPort: number;
  targetUsername: string;
  sourceUsername: string;
  sourcePassword: string;
  sourcePort: number;
  sourceDbName: string;
  targetDbName: string;
};
export const spawnCopyDb = async (opts: Opts) => {
  const script = createCopyDbScript(opts);

  return await spawn(script, [], {
    shell: "bash",
    stdio: "inherit",
  });
};
const createCopyDbScript = ({
  targetPassword,
  targetPort,
  targetUsername,
  sourceUsername,
  sourcePassword,
  sourcePort,
  sourceDbName,
  targetDbName,
}: Opts) => {
  const targetPSQL = (command: string) =>
    `PGPASSWORD=${targetPassword} psql -p ${targetPort} --host=localhost --user=${targetUsername} -q ${command}`;

  const copyDBScript = `
      set -e
     
    

      dumptmp=$(mktemp /tmp/dump.XXXXXX)

      echo "Dumping file to $dumptmp"
      pg_dump --dbname=postgres://${sourceUsername}:${sourcePassword}@localhost:${sourcePort}/${sourceDbName} --no-owner --no-privileges > $dumptmp
      echo "dump done"
      ${targetPSQL(
        `-c 'drop database "${targetDbName}" WITH (FORCE)' 1> /dev/null || true`,
      )}
      ${targetPSQL(`-c 'create database "${targetDbName}"' 1> /dev/null`)}
          echo "Restoring dump..."
      ${targetPSQL(`"${targetDbName}" < $dumptmp 1> /dev/null`)}
  

      echo "Clean up..."
      set +e
      rm $dumptmp
      echo "\n🐱 Done!"
      `;
  return copyDBScript;
};
