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

  // URL-encode credentials to handle special characters like @, :, /, etc.
  const encodedSourceUsername = encodeURIComponent(sourceUsername);
  const encodedSourcePassword = encodeURIComponent(sourcePassword);

  const copyDBScript = `
      set -e

      ${targetPSQL(
        // connect to the always-existing "postgres" maintenance database:
        // without an explicit dbname, psql falls back to the username and
        // fails with e.g. 'FATAL: database "user" does not exist'
        `--dbname=postgres -c 'drop database "${targetDbName}" WITH (FORCE)' 1> /dev/null || true`,
      )}
      ${targetPSQL(
        `--dbname=postgres -c 'create database "${targetDbName}"' 1> /dev/null`,
      )}
      echo "Estimating database size..."
      DB_SIZE=$(PGPASSWORD=${encodedSourcePassword} psql --dbname=postgres://${encodedSourceUsername}:${encodedSourcePassword}@localhost:${sourcePort}/${sourceDbName} -t -A -c "SELECT pg_database_size('${sourceDbName}')")
      # pg_database_size includes indexes, TOAST, and free space — pg_dump output is roughly 40% of that
      ESTIMATED_DUMP_SIZE=$((DB_SIZE * 40 / 100))
      echo "Estimated dump size: $((ESTIMATED_DUMP_SIZE / 1024 / 1024)) MB (~40% of $((DB_SIZE / 1024 / 1024)) MB database size)"

      PROGRESS=""
      if command -v pv &> /dev/null; then
        PROGRESS="pv -s $ESTIMATED_DUMP_SIZE |"
      else
        echo "(install 'pv' for progress info)"
      fi

      echo "Dumping and restoring via pipe..."
      eval "pg_dump --dbname=postgres://${encodedSourceUsername}:${encodedSourcePassword}@localhost:${sourcePort}/${sourceDbName} --no-owner --no-privileges | $PROGRESS ${targetPSQL(`"${targetDbName}" 1> /dev/null`)}"

      echo "\n🐱 Done!"
      `;
  return copyDBScript;
};
