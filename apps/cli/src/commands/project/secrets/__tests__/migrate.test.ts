import { getSecretVarName } from "@catladder/pipeline";
import { describe, expect, it, vi } from "vitest";
import type { IO } from "../../../../core/types";
import type { SecretsVault } from "../../../../vault/types";
import { FILL_ME } from "../document";
import {
  executeMigration,
  formatPlan,
  formatResult,
  planMigration,
  runMigration,
  verifyMigration,
} from "../migrate";
import type { ScopedSecretKeys } from "../scope";

const scoped: ScopedSecretKeys = [
  { env: "dev", componentName: "web", keys: ["API_KEY", "SMTP"] },
  { env: "prod", componentName: "web", keys: ["API_KEY"] },
  { env: "dev", componentName: "worker", keys: ["QUEUE"] },
];

const raw = (env: string, component: string, key: string) =>
  getSecretVarName(env, component, key);

/** a fake vault backed by a flat raw-name map */
const fakeVault = (
  initial: Record<string, string> = {},
  opts: { failFor?: string; corrupt?: boolean } = {},
) => {
  const store = { ...initial };
  const writeSecrets = vi.fn(
    async (
      _io: IO,
      env: string,
      component: string,
      secrets: Record<string, unknown>,
    ) => {
      if (opts.failFor === `${env}:${component}`) {
        throw new Error(
          `boom ${Object.values(secrets).join(" ")} while writing`,
        );
      }
      for (const [k, v] of Object.entries(secrets)) {
        store[raw(env, component, k)] =
          typeof v === "string" ? v : JSON.stringify(v);
      }
    },
  );
  const readAllSecrets = vi.fn(async () =>
    opts.corrupt
      ? Object.fromEntries(Object.keys(store).map((k) => [k, "other"]))
      : { ...store },
  );
  const vault: SecretsVault = { id: "fake", readAllSecrets, writeSecrets };
  return { vault, store, writeSecrets, readAllSecrets };
};

const makeIo = () => {
  const log = vi.fn();
  return { io: { log } as unknown as IO, log };
};

const source = {
  [raw("dev", "web", "API_KEY")]: "s3cret-dev-api",
  [raw("dev", "web", "SMTP")]: "s3cret-smtp",
  [raw("prod", "web", "API_KEY")]: "s3cret-prod-api",
  [raw("dev", "worker", "QUEUE")]: "s3cret-queue",
};

describe("planMigration", () => {
  it("creates everything for an empty target", () => {
    const plan = planMigration(scoped, source, {}, { overwrite: false });
    expect(plan.map((e) => e.action)).toEqual([
      "create",
      "create",
      "create",
      "create",
    ]);
  });

  it("marks identical values as equal (idempotent re-run)", () => {
    const plan = planMigration(scoped, source, source, { overwrite: false });
    expect(plan.every((e) => e.action === "equal")).toBe(true);
  });

  it("reports conflicts without overwrite and overwrites with it", () => {
    const target = { [raw("dev", "web", "API_KEY")]: "different" };
    expect(
      planMigration(scoped, source, target, { overwrite: false })[0].action,
    ).toBe("conflict");
    expect(
      planMigration(scoped, source, target, { overwrite: true })[0].action,
    ).toBe("overwrite");
  });

  it("skips unset, empty and placeholder source values", () => {
    const plan = planMigration(
      scoped,
      {
        [raw("dev", "web", "API_KEY")]: FILL_ME,
        [raw("dev", "web", "SMTP")]: "",
      },
      {},
      { overwrite: false },
    );
    expect(plan.map((e) => e.action)).toEqual([
      "unset",
      "unset",
      "unset",
      "unset",
    ]);
  });

  it("treats a placeholder in the target as absent", () => {
    const plan = planMigration(
      scoped,
      source,
      { [raw("dev", "web", "API_KEY")]: FILL_ME },
      { overwrite: false },
    );
    expect(plan[0].action).toBe("create");
  });

  it("ignores backup and unrelated variables of a gitlab-like superset", () => {
    const superset = {
      ...source,
      [`${raw("dev", "web", "API_KEY")}_backup_2024`]: "old-secret",
      UNRELATED: "x",
    };
    const plan = planMigration(scoped, superset, {}, { overwrite: false });
    expect(plan).toHaveLength(4);
    expect(plan.map((e) => e.value)).not.toContain("old-secret");
  });
});

describe("executeMigration / runMigration", () => {
  it("copies everything with backup: true, one write per env:component", async () => {
    const { vault, store, writeSecrets } = fakeVault();
    const { io } = makeIo();
    const plan = planMigration(scoped, source, {}, { overwrite: false });
    const result = await runMigration(io, plan, vault);
    expect(store).toEqual(source);
    expect(writeSecrets).toHaveBeenCalledTimes(3);
    for (const call of writeSecrets.mock.calls) {
      expect(call[4]).toEqual({ backup: true });
    }
    expect(result.created).toHaveLength(4);
    expect(result.failed).toEqual([]);
  });

  it("copies only the scoped part", async () => {
    const { vault, store } = fakeVault();
    const { io } = makeIo();
    const plan = planMigration([scoped[0]], source, {}, { overwrite: false });
    await runMigration(io, plan, vault);
    expect(Object.keys(store).sort()).toEqual(
      [raw("dev", "web", "API_KEY"), raw("dev", "web", "SMTP")].sort(),
    );
  });

  it("dry run (plan only) performs zero writes", async () => {
    const { writeSecrets } = fakeVault();
    planMigration(scoped, source, {}, { overwrite: false });
    expect(writeSecrets).not.toHaveBeenCalled();
  });

  it("is idempotent: a second run writes nothing", async () => {
    const { vault, writeSecrets, store } = fakeVault();
    const { io } = makeIo();
    await runMigration(
      io,
      planMigration(scoped, source, {}, { overwrite: false }),
      vault,
    );
    writeSecrets.mockClear();
    const result = await runMigration(
      io,
      planMigration(scoped, source, store, { overwrite: false }),
      vault,
    );
    expect(writeSecrets).not.toHaveBeenCalled();
    expect(result.skipped).toHaveLength(4);
    expect(result.failed).toEqual([]);
  });

  it("leaves conflicts untouched without overwrite, overwrites with it", async () => {
    const existing = { [raw("dev", "web", "API_KEY")]: "old" };
    const a = fakeVault(existing);
    const { io } = makeIo();
    const r1 = await runMigration(
      io,
      planMigration(scoped, source, existing, { overwrite: false }),
      a.vault,
    );
    expect(r1.conflicts).toEqual(["dev:web:API_KEY"]);
    expect(a.store[raw("dev", "web", "API_KEY")]).toBe("old");

    const b = fakeVault(existing);
    const r2 = await runMigration(
      io,
      planMigration(scoped, source, existing, { overwrite: true }),
      b.vault,
    );
    expect(r2.overwritten).toEqual(["dev:web:API_KEY"]);
    expect(b.store[raw("dev", "web", "API_KEY")]).toBe("s3cret-dev-api");
  });

  it("skips unset values without writing them", async () => {
    const { vault, store } = fakeVault();
    const { io } = makeIo();
    const only = { [raw("dev", "web", "API_KEY")]: "v" };
    const result = await runMigration(
      io,
      planMigration(scoped, only, {}, { overwrite: false }),
      vault,
    );
    expect(Object.keys(store)).toEqual([raw("dev", "web", "API_KEY")]);
    expect(result.skipped).toHaveLength(3);
  });

  it("continues after a failing env:component and sanitizes the message", async () => {
    const { vault, store } = fakeVault({}, { failFor: "prod:web" });
    const { io, log } = makeIo();
    const plan = planMigration(scoped, source, {}, { overwrite: false });
    const result = await runMigration(io, plan, vault);
    expect(result.failed).toEqual(["prod:web:API_KEY"]);
    expect(result.created).toHaveLength(3);
    expect(store[raw("dev", "worker", "QUEUE")]).toBe("s3cret-queue");
    const logged = log.mock.calls.flat().join("\n");
    expect(logged).toContain("prod:web");
    expect(logged).not.toContain("s3cret");
  });

  it("verification mismatch becomes a failed env:component:KEY", async () => {
    const { vault } = fakeVault({}, { corrupt: true });
    const { io } = makeIo();
    const plan = planMigration(scoped, source, {}, { overwrite: false });
    const result = await runMigration(io, plan, vault);
    expect(result.created).toEqual([]);
    expect(result.failed.sort()).toEqual(
      [
        "dev:web:API_KEY",
        "dev:web:SMTP",
        "prod:web:API_KEY",
        "dev:worker:QUEUE",
      ].sort(),
    );
  });

  it("reads the target back only once", async () => {
    const { vault, readAllSecrets } = fakeVault();
    const { io } = makeIo();
    const plan = planMigration(scoped, source, {}, { overwrite: false });
    const executed = await executeMigration(io, plan, vault);
    await verifyMigration(io, plan, executed, vault);
    expect(readAllSecrets).toHaveBeenCalledTimes(1);
  });

  it("an unreadable target fails verification without leaking values", async () => {
    const { vault, readAllSecrets } = fakeVault();
    readAllSecrets.mockRejectedValue(new Error("nope s3cret-queue"));
    const { io, log } = makeIo();
    const plan = planMigration(scoped, source, {}, { overwrite: false });
    const result = await runMigration(io, plan, vault);
    expect(result.failed).toHaveLength(4);
    expect(log.mock.calls.flat().join("\n")).not.toContain("s3cret");
  });
});

describe("output never contains secret values", () => {
  it("formatPlan and formatResult print names and counts only", async () => {
    const { vault } = fakeVault({ [raw("dev", "web", "API_KEY")]: "old-val" });
    const { io, log } = makeIo();
    const plan = planMigration(
      scoped,
      source,
      { [raw("dev", "web", "API_KEY")]: "old-val" },
      { overwrite: false },
    );
    const result = await runMigration(io, plan, vault);
    const output = [
      formatPlan(plan),
      formatResult(result),
      ...log.mock.calls.flat(),
    ].join("\n");
    expect(output).not.toContain("s3cret");
    expect(output).not.toContain("old-val");
    expect(output).toContain("dev:web:API_KEY");
    expect(output).toContain("1 conflicts");
  });
});
