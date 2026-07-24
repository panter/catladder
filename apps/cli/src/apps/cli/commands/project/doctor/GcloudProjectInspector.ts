import { exec } from "child-process-promise";
import { CATLADDER_REGISTRY_NAME } from "../../../../../gcloud/artifactsRegistry";

type IamBinding = { role: string; members?: string[] };

/**
 * read-only gcloud queries for the doctor, cached per project: checking
 * many component/env contexts of the same gcloud project costs one
 * `get-iam-policy` / `services list` call, not one per context
 */
export class GcloudProjectInspector {
  private readonly iamBindings = new Map<string, Promise<IamBinding[]>>();
  private readonly enabledServices = new Map<string, Promise<Set<string>>>();

  async isAuthenticated(): Promise<boolean> {
    try {
      await exec("gcloud auth print-access-token");
      return true;
    } catch {
      return false;
    }
  }

  private getIamBindings(projectId: string): Promise<IamBinding[]> {
    if (!this.iamBindings.has(projectId)) {
      this.iamBindings.set(
        projectId,
        exec(`gcloud projects get-iam-policy ${projectId} --format=json`).then(
          (result) => JSON.parse(result.stdout).bindings ?? [],
        ),
      );
    }
    return this.iamBindings.get(projectId)!;
  }

  /** all roles bound to the given member (e.g. "serviceAccount:<email>") */
  async getRolesOfMember(projectId: string, member: string): Promise<string[]> {
    const bindings = await this.getIamBindings(projectId);
    return bindings
      .filter((binding) => binding.members?.includes(member))
      .map((binding) => binding.role);
  }

  getEnabledServices(projectId: string): Promise<Set<string>> {
    if (!this.enabledServices.has(projectId)) {
      this.enabledServices.set(
        projectId,
        exec(
          `gcloud services list --enabled --project=${projectId} --format="value(config.name)"`,
        ).then(
          (result) =>
            new Set(
              result.stdout
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            ),
        ),
      );
    }
    return this.enabledServices.get(projectId)!;
  }

  async hasArtifactsRegistry(
    projectId: string,
    region: string,
  ): Promise<boolean> {
    try {
      await exec(
        `gcloud artifacts repositories describe ${CATLADDER_REGISTRY_NAME} --project="${projectId}" --location=${region}`,
      );
      return true;
    } catch {
      return false;
    }
  }
}
