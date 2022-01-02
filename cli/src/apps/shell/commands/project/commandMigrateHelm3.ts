import { exec } from "child-process-promise";
import Vorpal from "vorpal";
import { logError } from "../../../../utils/log";
import { getProjectHelmReleaseName } from "../../../../utils/projects";
import { envAutocompletion } from "./utils/autocompletions";

/**
 * Error: rendered manifests contain a resource that already exists.
 * Unable to continue with install: ConfigMap "web-app-env" in namespace "pvl-bike2school-dev" exists and cannot be imported into the current release: invalid ownership metadata; label validation error: missing key "app.kubernetes.io/managed-by": must be set to "Helm"; annotation validation error: missing key "meta.helm.sh/release-name": must be set to "pvl-bike2school-dev-web"; annotation validation error: missing key "meta.helm.sh/release-namespace": must be set to "pvl-bike2school-dev"
 */
export default (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-migrate-helm3 <env>",
      "Do manual step for helm2 to helm3 migration"
    )
    .autocomplete(
      envAutocompletion.filter((e) => e !== "dev-local" && e !== "review")
    )
    .action(async function ({ env }) {
      try {
        const result = await exec("helm version --short");
        const version = result.stdout as string;
        this.log(`your helm version: ${version}`);
        if (!version.startsWith("v3")) {
          throw new Error("no helm3");
        }
        try {
          await exec(
            "helm plugin install https://github.com/helm/helm-2to3.git"
          );
          this.log(
            "successfully installed plugin https://github.com/helm/helm-2to3.git"
          );
        } catch (e) {
          // ignore
        }
        const releaseName = await getProjectHelmReleaseName(env);
        this.log(`helm release name: ${releaseName}`);
        this.log("");
        this.log("migrating now... 😼. This may take a moment");
        this.log("");
        const r = await exec(
          `helm 2to3 convert --delete-v2-releases ${releaseName}`
        );
        this.log(r);
      } catch (e) {
        logError(this, e.message);
        this.log("make sure that you have installed latest helm3 locally");
        this.log("(e.g. brew upgrade helm)");
        this.log("");
      }
    });
