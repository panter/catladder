import { describe, expect, it } from "vitest";
import type { ComponentContext } from "@catladder/pipeline";
import {
  getLocalAccessServiceAccountNames,
  getConditionalRolesOfMemberInBindings,
  getRolesOfMemberInBindings,
  parseServiceAccountKey,
} from "../localAccess";

const context = {
  env: "review",
  name: "web",
  fullConfig: { customerName: "acme", appName: "shop" },
} as ComponentContext;

describe("getLocalAccessServiceAccountNames", () => {
  it("is deterministic, within the 30 char limit and distinct from the deploy account", () => {
    const a = getLocalAccessServiceAccountNames(context, "some-project");
    const b = getLocalAccessServiceAccountNames(context, "some-project");
    expect(a).toEqual(b);
    expect(a.fullName.length).toBeLessThanOrEqual(30);
    expect(a.fullName.startsWith("local-diag-")).toBe(true);
    expect(a.fullIdentifier).toBe(
      `${a.fullName}@some-project.iam.gserviceaccount.com`,
    );
  });
});

describe("getRolesOfMemberInBindings", () => {
  it("collects the sorted roles of exactly the given member", () => {
    const m = "serviceAccount:a@p.iam.gserviceaccount.com";
    expect(
      getRolesOfMemberInBindings(
        [
          { role: "roles/logging.viewer", members: [m, "user:x@y.z"] },
          { role: "roles/b.viewer", members: [m] },
          { role: "roles/run.admin", members: ["user:x@y.z"] },
          { role: "roles/other" },
        ],
        m,
      ),
    ).toEqual(["roles/b.viewer", "roles/logging.viewer"]);
  });
});

describe("conditional bindings", () => {
  const m = "serviceAccount:a@p.iam.gserviceaccount.com";
  const bindings = [
    { role: "roles/logging.viewer", members: [m] },
    {
      role: "roles/storage.objectViewer",
      members: [m],
      condition: { title: "t", expression: "true" },
    },
  ];
  it("keeps them out of the plain roles and reports them separately", () => {
    expect(getRolesOfMemberInBindings(bindings, m)).toEqual([
      "roles/logging.viewer",
    ]);
    expect(getConditionalRolesOfMemberInBindings(bindings, m)).toEqual([
      "roles/storage.objectViewer",
    ]);
  });
});

describe("parseServiceAccountKey", () => {
  it("accepts a key and returns its id", () => {
    const raw = JSON.stringify({ private_key_id: "abc", private_key: "x" });
    expect(parseServiceAccountKey(raw)).toEqual({
      key: raw,
      privateKeyId: "abc",
    });
  });
  it.each(["", "not json", "{}", '{"private_key_id":"a"}'])(
    "rejects %j instead of storing it",
    (raw) => {
      expect(() => parseServiceAccountKey(raw)).toThrow(
        /valid service account key/,
      );
    },
  );
});
