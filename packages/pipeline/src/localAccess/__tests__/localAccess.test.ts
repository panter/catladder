import { describe, expect, it } from "vitest";
import type { Config } from "../../types";
import {
  diffRoleBindings,
  getLocalAccessDb,
  getLocalAccessDbEnvs,
  getLocalAccessDbSecretName,
  getLocalAccessGcpCredentialsEnvVars,
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
    // read-only by name, but expose data/secrets or are unknown
    "roles/storage.objectViewer",
    "roles/cloudfunctions.viewer",
    "roles/cloudbuild.builds.viewer",
    "roles/compute.viewer",
    "roles/logging.privateLogViewer",
    "projects/p/roles/custom.reader",
  ])("rejects the role %s", (role) => {
    const c = config({ localAccess: { gcp: { roles: [role] } } });
    expect(() => getLocalAccessGcpRoles(c, "dev")).toThrow(/not allowed/);
  });

  it.each([
    "roles/logging.viewer",
    "roles/monitoring.viewer",
    "roles/errorreporting.viewer",
  ])("accepts the known-safe role %s", (role) => {
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
    const custom = config({
      localAccess: {
        gcp: { roles: ["projects/p/roles/custom.reader"], allowAnyRole: true },
      },
    });
    expect(getLocalAccessGcpRoles(custom, "dev")).toEqual([
      "projects/p/roles/custom.reader",
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

  it("expands the vertex preset to aiplatform.user", () => {
    const c = config({
      localAccess: { gcp: { presets: ["logs", "vertex"] } },
    });
    expect(getLocalAccessGcpRoles(c, "dev")).toEqual([
      "roles/aiplatform.user",
      "roles/logging.viewer",
    ]);
  });

  it("grants aiplatform.user only through the vertex preset", () => {
    for (const allowAnyRole of [false, true]) {
      const c = config({
        localAccess: {
          gcp: { roles: ["roles/aiplatform.user"], allowAnyRole },
        },
      });
      expect(() => getLocalAccessGcpRoles(c, "dev")).toThrow(/not allowed/);
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

  it("respects a per-env deploy override", () => {
    const c = config({
      localAccess: { gcp: { presets: ["logs"] } },
      components: {
        web: {
          dir: ".",
          build: false,
          deploy: { type: "google-cloudrun", projectId: "p", region: "r" },
          env: { prod: { deploy: false } },
        },
      } as any,
    });
    const envs = getLocalAccessGcpEnvs(c, "web");
    expect(envs).toContain("dev");
    expect(envs).not.toContain("prod");
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

describe("getLocalAccessGcpCredentialsEnvVars", () => {
  const cloudRun = {
    web: {
      dir: ".",
      build: false,
      deploy: { type: "google-cloudrun", projectId: "p", region: "r" },
    },
  } as any;
  const vertex = (credentialsEnvVar?: string) => ({
    gcp: { presets: ["vertex" as const], credentialsEnvVar },
  });

  it("maps the declared name to its env", () => {
    const c = config({
      components: cloudRun,
      localAccess: { gcp: { presets: ["logs"] } },
      environments: {
        dev: { localAccess: vertex("GOOGLE_APPLICATION_CREDENTIALS") },
      },
    });
    expect(getLocalAccessGcpCredentialsEnvVars(c, "web")).toEqual({
      GOOGLE_APPLICATION_CREDENTIALS: "dev",
    });
  });

  it("is empty without a declared name or for other deploy types", () => {
    expect(
      getLocalAccessGcpCredentialsEnvVars(
        config({ components: cloudRun, localAccess: vertex() }),
        "web",
      ),
    ).toEqual({});
    expect(
      getLocalAccessGcpCredentialsEnvVars(
        config({ localAccess: vertex("GOOGLE_APPLICATION_CREDENTIALS") }),
        "web",
      ),
    ).toEqual({});
  });

  it("rejects a name exported by two envs", () => {
    const c = config({
      components: cloudRun,
      localAccess: vertex("GOOGLE_APPLICATION_CREDENTIALS"),
    });
    expect(() => getLocalAccessGcpCredentialsEnvVars(c, "web")).toThrow(
      /declared by both/,
    );
  });

  it("rejects an invalid name", () => {
    const c = config({
      components: cloudRun,
      environments: { dev: { localAccess: vertex("NOT-VALID") } },
    });
    expect(() => getLocalAccessGcpCredentialsEnvVars(c, "web")).toThrow(
      /not a valid env var name/,
    );
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

describe("db access", () => {
  const cloudRun = (cloudSql: boolean) => ({
    dir: ".",
    build: false as const,
    deploy: {
      type: "google-cloudrun" as const,
      projectId: "p",
      region: "europe-west6" as const,
      service: {},
      ...(cloudSql
        ? {
            cloudSql: {
              type: "unmanaged" as const,
              instanceConnectionName: "p:r:i",
            },
          }
        : {}),
    },
  });

  it("is off without a declaration", () => {
    expect(getLocalAccessDb(config({}), "dev")).toBeUndefined();
  });

  it("reads the readonly shorthand and the object form", () => {
    expect(
      getLocalAccessDb(config({ localAccess: { db: "readonly" } }), "dev"),
    ).toBe("readonly");
    expect(
      getLocalAccessDb(
        config({ localAccess: { db: { mode: "readonly" } } }),
        "review",
      ),
    ).toBe("readonly");
  });

  it("skips prod for the project default, allows it with allowProd", () => {
    const c = config({ localAccess: { db: "readonly" } });
    expect(getLocalAccessDb(c, "prod")).toBeUndefined();
    const allowed = config({
      localAccess: { db: { mode: "readonly", allowProd: true } },
    });
    expect(getLocalAccessDb(allowed, "prod")).toBe("readonly");
  });

  it("rejects an env's own prod declaration without allowProd", () => {
    const c = config({
      environments: { prod: { localAccess: { db: "readonly" } } },
    });
    expect(() => getLocalAccessDb(c, "prod")).toThrow(/allowProd/);
  });

  it("rejects custom envs of type prod", () => {
    const c = config({
      environments: {
        live: { type: "prod", localAccess: { db: "readonly" } },
      },
    });
    expect(() => getLocalAccessDb(c, "live")).toThrow(/prod/);
  });

  it("rejects an unknown mode", () => {
    const c = config({ localAccess: { db: "readwrite" as any } });
    expect(() => getLocalAccessDb(c, "dev")).toThrow(/unknown db mode/);
  });

  it("adds the cloudsql client role, also without gcp presets", () => {
    const c = config({ localAccess: { db: "readonly" } });
    expect(getLocalAccessGcpRoles(c, "dev")).toEqual(["roles/cloudsql.client"]);
    const withLogs = config({
      localAccess: { gcp: { presets: ["logs"] }, db: "readonly" },
    });
    expect(getLocalAccessGcpRoles(withLogs, "dev")).toEqual([
      "roles/cloudsql.client",
      "roles/logging.viewer",
    ]);
  });

  it("still rejects the client role in explicit roles", () => {
    const c = config({
      localAccess: { gcp: { roles: ["roles/cloudsql.client"] } },
    });
    expect(() => getLocalAccessGcpRoles(c, "dev")).toThrow(/not allowed/);
  });

  it("only lists envs of cloud run components with cloudSql", () => {
    const c = config({
      localAccess: { db: "readonly" },
      environments: { prod: { localAccess: false } },
      components: {
        withSql: cloudRun(true),
        withoutSql: cloudRun(false),
      },
    });
    const envs = getLocalAccessDbEnvs(c, "withSql");
    expect(envs).toContain("dev");
    expect(envs).toContain("review");
    expect(envs).not.toContain("prod");
    expect(getLocalAccessDbEnvs(c, "withoutSql")).toEqual([]);
  });

  it("names the secret per env", () => {
    expect(getLocalAccessDbSecretName("review")).toBe(
      "LOCAL_ACCESS_DB_REVIEW_CREDENTIALS",
    );
  });
});
