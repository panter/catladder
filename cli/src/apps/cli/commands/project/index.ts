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
import commandRenewToken from "./commandRenewToken";
import commandListPods from "./commandListPods";
import commandNamespace from "./commandNamespace";
import commandOpenCostDashboard from "./commandOpenCostDashboard";
import commandOpenDashboard from "./commandOpenDashboard";
import commandOpenEnv from "./commandOpenEnv";
import commandOpenGit from "./commandOpenGit";
import commandOpenLogs from "./commandOpenLogs";
import commandPauseProject from "./commandPauseProject";
import commandPortForward from "./commandPortForward";
import commandTriggerCronjob from "./commandTriggerCronjob";
import commandSecretsClearBackups from "./commandSecretsClearBackups";
import commandProjectRestoreDb from "./cloudSql/commandProjectRestoreDb";
import commandSecurityEvaluate from "./commandSecurityEvaluate";

export default async (vorpal: Vorpal) => {
  commandSetup(vorpal);
  commandRenewToken(vorpal);

  commandEnvVars(vorpal);

  commandNamespace(vorpal);
  commandListPods(vorpal);
  commandPauseProject(vorpal);
  commandDeleteProject(vorpal);

  commandOpenDashboard(vorpal);

  commandOpenLogs(vorpal);

  commandOpenCostDashboard(vorpal);

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

  commandSecurityEvaluate(vorpal);
};
