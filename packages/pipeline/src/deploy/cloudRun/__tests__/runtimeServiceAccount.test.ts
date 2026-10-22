import { describe, expect, it } from "vitest";
import {
  getManagedRuntimeServiceAccountEmail,
  getRuntimeServiceAccountBucketRoles,
  getRuntimeServiceAccountRoles,
} from "../runtimeServiceAccount";

const base = { projectId: "some-project" };

describe("getRuntimeServiceAccountRoles", () => {
  it("is empty without a managed account", () => {
    expect(
      getRuntimeServiceAccountRoles({ ...base, cloudSql: {} as never }),
    ).toEqual([]);
    expect(
      getRuntimeServiceAccountRoles({
        ...base,
        runtimeServiceAccount: "x@y.iam.gserviceaccount.com",
      }),
    ).toEqual([]);
  });

  it("implies cloudsql.client with cloudSql and adds configured roles", () => {
    expect(
      getRuntimeServiceAccountRoles({
        ...base,
        cloudSql: {} as never,
        runtimeServiceAccount: {
          roles: ["roles/aiplatform.user", "roles/cloudsql.client"],
        },
      }),
    ).toEqual(["roles/cloudsql.client", "roles/aiplatform.user"]);
  });

  it("accepts true as shorthand", () => {
    expect(
      getRuntimeServiceAccountRoles({ ...base, runtimeServiceAccount: true }),
    ).toEqual([]);
  });
});

describe("getRuntimeServiceAccountBucketRoles", () => {
  it("merges volume buckets with configured bucket roles", () => {
    expect(
      getRuntimeServiceAccountBucketRoles({
        ...base,
        runtimeServiceAccount: {
          bucketRoles: { media: ["roles/storage.objectUser"] },
        },
        service: {
          volumes: {
            assets: {
              type: "cloud-storage",
              bucket: "assets",
              mountPath: "/assets",
              readonly: true,
            },
            dynamic: {
              type: "cloud-storage",
              bucket: "$BUCKET",
              mountPath: "/dyn",
            },
          },
        },
        jobs: {
          import: {
            command: "import",
            volumes: {
              media: {
                type: "cloud-storage",
                bucket: "media",
                mountPath: "/m",
              },
            },
          },
          disabled: null,
        },
      }),
    ).toEqual({
      assets: ["roles/storage.objectViewer"],
      media: ["roles/storage.objectUser"],
    });
  });
});

describe("getManagedRuntimeServiceAccountEmail", () => {
  it("uses the cl-r prefix and stays within 30 chars", () => {
    const email = getManagedRuntimeServiceAccountEmail(
      {
        env: "review",
        name: "web",
        fullConfig: { customerName: "zue", appName: "zuerich-tourismus" },
      } as never,
      "zue-tourismus",
    );
    const [id] = email.split("@");
    expect(id.startsWith("cl-r-")).toBe(true);
    expect(id.length).toBeLessThanOrEqual(30);
    expect(email.endsWith("@zue-tourismus.iam.gserviceaccount.com")).toBe(true);
  });
});
