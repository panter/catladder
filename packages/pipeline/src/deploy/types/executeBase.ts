type DeployConfigBaseExecuteScript = {
  type: "script";
  script: string | string[];
};
/**
 * currently only supported for cloud run deployments
 */
export type DeployConfigBaseExecuteOnDeploy = DeployConfigBaseExecuteScript &
  (
    | {
        /**
         * run the job before or after the deploy
         */
        when: "preDeploy" | "postDeploy";
        /**
         * whether to wait for completion of the job
         */
        waitForCompletion?: boolean;
      }
    | {
        /**
         * run the job before or after the environment is stopped
         */
        when: "preStop" | "postStop";
      }
  );
export type DeployConfigBaseExecute = DeployConfigBaseExecuteOnDeploy;
