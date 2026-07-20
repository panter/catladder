import { describe, expect, it } from "vitest";
import { getGcloudServiceAccountNames } from "../serviceAccountNames";

// the naming is shared between `project setup` (creates accounts) and
// `project doctor` (computes the expected identifier) — these tests pin
// it down so a change never silently makes doctor look for accounts
// under a different name than setup created them

const account = { name: "cl-d", projectId: "some-project" };

describe("getGcloudServiceAccountNames", () => {
  it("keeps all parts verbatim when they fit into 30 chars", () => {
    const { fullName, fullIdentifier } = getGcloudServiceAccountNames(
      {
        env: "dev",
        name: "www",
        fullConfig: { customerName: "acme", appName: "shop" },
      },
      account,
    );
    expect(fullName).toBe("cl-d-acme-shop-dev-www");
    expect(fullIdentifier).toBe(
      "cl-d-acme-shop-dev-www@some-project.iam.gserviceaccount.com",
    );
  });

  it("hashes the customer/app middle part when the name would exceed 30 chars", () => {
    const { fullName } = getGcloudServiceAccountNames(
      {
        env: "review",
        name: "outlet-stats",
        fullConfig: { customerName: "wea", appName: "food2050" },
      },
      account,
    );
    expect(fullName).toMatch(/^cl-d-[0-9a-f]{5}-review-outlet-stats$/);
    expect(fullName.length).toBe(30);
  });

  it("hashes the env/component suffix too when a 1-char middle still does not fit", () => {
    const { fullName } = getGcloudServiceAccountNames(
      {
        env: "review",
        name: "a-component-with-a-very-long-name",
        fullConfig: { customerName: "customer", appName: "app" },
      },
      account,
    );
    expect(fullName).toMatch(/^cl-d-[0-9a-f]-[0-9a-f]{23}$/);
    expect(fullName.length).toBe(30);
  });

  it("is deterministic", () => {
    const context = {
      env: "review",
      name: "outlet-stats",
      fullConfig: { customerName: "wea", appName: "food2050" },
    };
    expect(getGcloudServiceAccountNames(context, account)).toEqual(
      getGcloudServiceAccountNames(context, account),
    );
  });
});
