import { describe, expect, it } from "vitest";
import type { Config } from "../../types";
import {
  diffRoleBindings,
  getLocalAccessGcpEnvs,
  getLocalAccessGcpRoles,
  getLocalAccessGcpSecretName,
} from "..";

const config = (extra: Partial<Config>): Config =>
  ({
    appName: "app",
    customerName: "acme",
    components: { web: { dir: ".", deploy: false, build: false } },
    ...extra,
  }) as Config;

describe("getLocalAccessGcpRoles", () => {
  it("is empty without a declaration", () => {
    expect(getLocalAccessGcpRoles(config({}), "dev")).toEqual([]);
  });

  it("expands the logs preset to logging.viewer only", () => {
    const c = config({ localAccess: { gcp: { presets: ["logs"] } } });
    expect(getLocalAccessGcpRoles(c, "dev")).toEqual(["roles/logging.viewer"]);
  });

  it("merges presets and explicit roles, deduplicated and sorted", () => {
    const c = config({
      localAccess: {
        gcp: {
          presets: ["logs"],
          roles: ["roles/monitoring.viewer", "roles/logging.viewer"],
        },
      },
    });
    expect(getLocalAccessGcpRoles(c, "dev")).toEqual([
      "roles/logging.viewer",
      "roles/monitoring.viewer",
    ]);
  });

  it("lets the env declaration replace the project default", () => {
    const c = config({
      localAccess: { gcp: { presets: ["logs"] } },
      environments: {
        prod: { localAccess: false },
        dev: { localAccess: { gcp: { roles: ["roles/monitoring.viewer"] } } },
      },
    });
    expect(getLocalAccessGcpRoles(c, "prod")).toEqual([]);
    expect(getLocalAccessGcpRoles(c, "dev")).toEqual([
      "roles/monitoring.viewer",
    ]);
    expect(getLocalAccessGcpRoles(c, "review")).toEqual([
      "roles/logging.viewer",
    ]);
  });

  it("never applies to the local env", () => {
    const c = config({ localAccess: { gcp: { presets: ["logs"] } } });
    expect(getLocalAccessGcpRoles(c, "local")).toEqual([]);
  });

  it.each([
    "roles/owner",
    "roles/editor",
    "roles/run.admin",
    "roles/cloudsql.admin",
    "roles/storage.objectAdmin",
    "roles/run.developer",
    "roles/run.invoker",
    "roles/iam.serviceAccountUser",
    "roles/iam.serviceAccountTokenCreator",
    "roles/compute.instanceAdmin.v1",
    "roles/viewer",
    "roles/run.viewer",
    "roles/secretmanager.secretAccessor",
    "roles/cloudbuild.builds.builder",
    "roles/storage.objectUser",
    "roles/pubsub.publisher",
    "roles/cloudsql.client",
    "roles/pubsub.subscriber",
  ])("rejects the write/admin role %s", (role) => {
    const c = config({ localAccess: { gcp: { roles: [role] } } });
    expect(() => getLocalAccessGcpRoles(c, "dev")).toThrow(/not allowed/);
  });

  it.each([
    "roles/logging.viewer",
    "roles/monitoring.viewer",
    "projects/p/roles/custom.reader",
  ])("accepts the read role %s", (role) => {
    const c = config({ localAccess: { gcp: { roles: [role] } } });
    expect(getLocalAccessGcpRoles(c, "dev")).toEqual([role]);
  });

  it("lifts the allow-list with allowAnyRole but keeps write and secret roles denied", () => {
    const ok = config({
      localAccess: {
        gcp: { roles: ["roles/pubsub.subscriber"], allowAnyRole: true },
      },
    });
    expect(getLocalAccessGcpRoles(ok, "dev")).toEqual([
      "roles/pubsub.subscriber",
    ]);
    for (const role of ["roles/run.viewer", "roles/owner", "roles/run.admin"]) {
      expect(() =>
        getLocalAccessGcpRoles(
          config({
            localAccess: { gcp: { roles: [role], allowAnyRole: true } },
          }),
          "dev",
        ),
      ).toThrow(/not allowed/);
    }
  });

  it("rejects malformed roles and unknown presets", () => {
    expect(() =>
      getLocalAccessGcpRoles(
        config({ localAccess: { gcp: { roles: ["logging.viewer"] } } }),
        "dev",
      ),
    ).toThrow(/not a valid role/);
    expect(() =>
      getLocalAccessGcpRoles(
        config({ localAccess: { gcp: { presets: ["nope" as any] } } }),
        "dev",
      ),
    ).toThrow(/unknown gcp preset/);
  });
});

describe("getLocalAccessGcpEnvs", () => {
  it("skips components that do not deploy to google cloud run", () => {
    const c = config({
      localAccess: { gcp: { presets: ["logs"] } },
      components: {
        web: { dir: ".", deploy: false, build: false },
        api: {
          dir: ".",
          build: false,
          deploy: { type: "google-cloudrun", projectId: "p", region: "r" },
        },
      } as any,
    });
    expect(getLocalAccessGcpEnvs(c, "web")).toEqual([]);
    expect(getLocalAccessGcpEnvs(c, "api").length).toBeGreaterThan(0);
  });

  it("lists the declaring envs of a component", () => {
    const c = config({
      components: {
        web: {
          dir: ".",
          build: false,
          deploy: { type: "google-cloudrun", projectId: "p", region: "r" },
        },
      } as any,
      environments: { dev: { localAccess: { gcp: { presets: ["logs"] } } } },
    });
    expect(getLocalAccessGcpEnvs(c, "web")).toEqual(["dev"]);
  });
});

describe("getLocalAccessGcpSecretName", () => {
  it("is deterministic and env-var safe", () => {
    expect(getLocalAccessGcpSecretName("review")).toBe(
      "LOCAL_ACCESS_GCP_REVIEW_CREDENTIALS",
    );
    expect(getLocalAccessGcpSecretName("my-env")).toBe(
      "LOCAL_ACCESS_GCP_MY_ENV_CREDENTIALS",
    );
  });
});

describe("diffRoleBindings", () => {
  it("reports missing and extra roles", () => {
    expect(diffRoleBindings(["a", "b"], ["b", "c"])).toEqual({
      missing: ["a"],
      extra: ["c"],
    });
    expect(diffRoleBindings(["a"], ["a"])).toEqual({ missing: [], extra: [] });
  });
});
