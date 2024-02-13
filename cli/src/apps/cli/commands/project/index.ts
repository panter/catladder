import type Vorpal from "vorpal";
import commandCloudSqlProxy from "./commandCloudSqlProxy";
import commandConfigSecrets from "./commandConfigSecrets";

import commandDeletePods from "./commandDeletePods";
import commandDeleteProject from "./commandDeleteProject";
import commandEnvVars from "./commandEnvVars";
import commandGetMyTotalWorktime from "./commandGetMyTotalWorktime";
import commandGetShell from "./commandGetShell";
import commandGitlabCi from "./commandGitlabCi";
import commandSetup from "./commandSetup";
//import commandInitProject from "./commandInitProject.old";
import commandListPods from "./commandListPods";
import commandMigrateHelm3 from "./commandMigrateHelm3";
import commandNamespace from "./commandNamespace";
import commandOpenCostDashboard from "./commandOpenCostDashboard";
import commandOpenDashboard from "./commandOpenDashboard";
import commandOpenEnv from "./commandOpenEnv";
import commandOpenGit from "./commandOpenGit";
import commandOpenLogs from "./commandOpenLogs";
import commandPauseProject from "./commandPauseProject";
import commandOpenGrafana from "./commandOpenGrafana";
import commandPortForward from "./commandPortForward";
import commandTriggerCronjob from "./commandTriggerCronjob";

import commandOpenGrafanaPod from "./commandOpenGrafanaPod";
import commandSecretsClearBackups from "./commandSecretsClearBackups";
import commandProjectRestoreDb from "./cloudSql/commandProjectRestoreDb";
import commandSecurityEvaluate from "./commandSecurityEvaluate";

export default async (vorpal: Vorpal) => {
  commandSetup(vorpal);

  commandEnvVars(vorpal);

  commandNamespace(vorpal);
  commandListPods(vorpal);
  commandPauseProject(vorpal);
  commandDeleteProject(vorpal);

  commandOpenDashboard(vorpal);

  commandOpenLogs(vorpal);

  commandOpenCostDashboard(vorpal);

  commandOpenGrafana(vorpal);
  commandOpenGrafanaPod(vorpal);
  commandCloudSqlProxy(vorpal);
  commandProjectRestoreDb(vorpal);
  commandOpenGit(vorpal);
  commandOpenEnv(vorpal);
  commandTriggerCronjob(vorpal);
  commandConfigSecrets(vorpal);
  commandSecretsClearBackups(vorpal);
  commandDeletePods(vorpal);

  commandGetShell(vorpal);
  commandPortForward(vorpal);

  commandGitlabCi(vorpal);

  commandGetMyTotalWorktime(vorpal);
  commandMigrateHelm3(vorpal);
  commandSecurityEvaluate(vorpal);
};
