// General commands
export { commandKubeCurrentContext } from "./general/commandKubeCurrentContext";
export { commandKubeListNamespaces } from "./general/commandKubeListNamespaces";
export { commandKubeListSecrets } from "./general/commandKubeListSecrets";
export { commandKubeListPods } from "./general/commandKubeListPods";
export { commandKubeStopPortforward } from "./general/commandKubeStopPortforward";
export { commandKubeGetShell } from "./general/commandKubeGetShell";
export { commandKubePortForward } from "./general/commandKubePortForward";

// Project commands
export { commandEnvVars } from "./project/commandEnvVars";
export { commandPortForward } from "./project/commandPortForward";
export { commandOpenEnv } from "./project/commandOpenEnv";
export { commandOpenGit } from "./project/commandOpenGit";
export { commandCloudSqlProxy } from "./project/commandCloudSqlProxy";
export { commandConfigSecrets } from "./project/commandConfigSecrets";
export { commandSecretsClearBackups } from "./project/commandSecretsClearBackups";
export { commandSecretsSyncGithub } from "./project/commandSecretsSyncGithub";
export { commandOpenLogs } from "./project/commandOpenLogs";
export { commandTriggerCronjobGeneral } from "./project/k8s/commandTriggerCronjob";
export { commandRenewToken } from "./project/commandRenewToken";
export { commandGetMyTotalWorktime } from "./project/commandGetMyTotalWorktime";
export { commandSetup } from "./project/commandSetup";
export { commandCiJobOpen, commandCiJobLog } from "./project/commandGitlabCi";
export { commandProjectRestoreDb } from "./project/commandProjectRestoreDb";
export { commandSecurityEvaluate } from "./project/commandSecurityEvaluate";

// Project k8s commands
export { commandNamespace } from "./project/k8s/commandNamespace";
export { commandListPods } from "./project/k8s/commandListPods";
export { commandGetShell } from "./project/k8s/commandGetShell";
export { commandDeletePods } from "./project/k8s/commandDeletePods";
export { commandPauseProject } from "./project/k8s/commandPauseProject";
export { commandDeleteProject } from "./project/k8s/commandDeleteProject";
export { commandTriggerCronjobProject } from "./project/k8s/commandTriggerCronjob";

// MongoDB commands
export { commandMongoGetShell } from "./mongodb/commandMongoGetShell";
export { commandMongoPortForward } from "./mongodb/commandMongoPortForward";
export { commandMongoDestroyMember } from "./mongodb/commandMongoDestroyMember";

// CloudSQL commands
export { commandRestoreDb } from "./cloudSQL/commandRestoreDb";

// Security commands
export { commandSecurityAuditCiJob } from "./security/commandSecurityAuditCiJob";
export { commandSecurityAuditEvaluate } from "./security/commandSecurityAuditEvaluate";
export { commandSecurityAuditCreate } from "./security/commandSecurityAuditCreate";

// Fun commands
export { commandDadjoke } from "./fun/commandDadjoke";
export { commandStarwars } from "./fun/commandStarwars";
