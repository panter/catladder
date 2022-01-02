import { spawn } from "child-process-promise";
import Vorpal from "vorpal";
import {
  GOOGLE_CLOUD_SQL_PASS_PATH,
  GOOGLE_PROJECT,
} from "../../../../config/constants";
import { readPass } from "../../../../utils/passwordstore";
import {
  getAllEnvVars,
  getLocalProjectVariables,
} from "../../../../utils/projects";
import { envAutocompletion } from "./utils/autocompletions";
import { promptForSubAppIfAny } from "./utils/monorepo";

export default (vorpal: Vorpal) =>
  vorpal
    .command("copy-db <env>", "replace local db with the one from an env")
    .autocomplete(envAutocompletion)
    .action(async function copyDB({ env }) {
      const {
        CUSTOMER_NAME,
        APP_NAME,
        COMPONENT_NAME = "web",
      } = await getLocalProjectVariables();

      const { shouldContinue } = await this.prompt({
        type: "confirm",
        name: "shouldContinue",
        message:
          "This will drop your local database and replace it with the remote one. Continue? 🤔 ",
      });

      if (!shouldContinue) {
        return;
      }

      const subapp = await promptForSubAppIfAny(this);

      const GOOGLE_CLOUD_SQL_REGION = "europe-west6"; // currently hardcoded
      const POSTGRESQL_PASSWORD = (await getAllEnvVars(env, subapp))
        ?.POSTGRESQL_PASSWORD;

      const LOCAL_PORT = 54321;

      const instanceName = `${GOOGLE_PROJECT}:${GOOGLE_CLOUD_SQL_REGION}:${CUSTOMER_NAME}-${APP_NAME}-${env}=tcp:${LOCAL_PORT}`;
      const cloudsqlCredentials = await readPass(GOOGLE_CLOUD_SQL_PASS_PATH);

      const { POSTGRESQL_URL } = process.env;
      const matches = new RegExp(/\w+:\/\/.*@.*\/(\w*)()/g).exec(
        POSTGRESQL_URL
      );
      if (!matches) {
        throw new Error("Could not determine db name.");
      }
      const localDBName = matches[1];

      const copyDBScript = `
      set -e
      credtmp=$(mktemp /tmp/cred.XXXXXX)
      echo '${cloudsqlCredentials}' > $credtmp
      echo "Opening connection..."
      cloud_sql_proxy -instances ${instanceName} -credential_file $credtmp &> /dev/null &
      PROXY_PID=$!

      echo -n "Waiting for proxy"
      until echo > /dev/tcp/localhost/${LOCAL_PORT}; do
        sleep 0.2
        echo -n "."
      done 2>/dev/null
      echo

      dumptmp=$(mktemp /tmp/dump.XXXXXX)

      echo "Dumping file to $dumptmp"
      pg_dump --dbname=postgres://postgres:${POSTGRESQL_PASSWORD}@localhost:${LOCAL_PORT}/${
        subapp ?? COMPONENT_NAME
      } --no-owner --no-privileges > $dumptmp
      psql -q -c "drop database ${localDBName}" 1> /dev/null
      psql -q -c "create database ${localDBName}" 1> /dev/null
      echo "Restoring dump..."
      psql -q ${localDBName} < $dumptmp 1> /dev/null

      echo "Clean up..."
      set +e
      kill -9 $PROXY_PID
      wait $PROXY_PID 2> /dev/null
      rm $credtmp
      rm $dumptmp
      echo "\n🐱 Done!"
      `;

      await spawn(copyDBScript, [], { shell: "bash", stdio: "inherit" });
    });
