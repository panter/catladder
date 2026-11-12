import type { ComponentContext } from "@catladder/pipeline";
import { getSecretVarName } from "@catladder/pipeline";
import { describe, expect, it, vi } from "vitest";
import {
  buildDropReadonlyRoleSql,
  buildReadonlyRoleSql,
  getStaticDbName,
  syncLocalAccessDb,
} from "../localAccessDb";

const context = {
  env: "dev",
  name: "web",
  fullConfig: { customerName: "acme", appName: "shop" },
} as ComponentContext;

const secretKey = getSecretVarName(
  "local",
  "web",
  "LOCAL_ACCESS_DB_DEV_CREDENTIALS",
);

const setup = (opts: { stored?: object; database?: unknown }) => {
  const vault = {
    readAllSecrets: vi.fn(async () =>
      opts.stored ? { [secretKey]: JSON.stringify(opts.stored) } : {},
    ),
  };
  const manager = {
    vault,
    writeSecrets: vi.fn(),
    cacheSecrets: vi.fn(),
  };
  const io = { log: vi.fn(), getVaultManager: async () => manager } as any;
  const sql: string[] = [];
  const deps = {
    runSql: vi.fn(async (_env: Record<string, string>, s: string) => {
      sql.push(s);
    }),
    withProxy: vi.fn(async (_i: string, _p: number, fn: () => Promise<any>) =>
      fn(),
    ),
    getAppCredentials: vi.fn(async () => ({
      user: "app",
      password: "apppw",
      database: "database" in opts ? opts.database : "acme-shop-dev-web",
    })),
  };
  return { io, manager, deps, sql };
};

describe("buildReadonlyRoleSql", () => {
  const sql = buildReadonlyRoleSql({
    role: "catladder_readonly",
    password: "pw",
    database: "acme-shop-dev-web",
    appUser: "app",
  });
  it("grants select only, never write privileges", () => {
    expect(sql).toContain(
      'GRANT SELECT ON ALL TABLES IN SCHEMA public TO "catladder_readonly"',
    );
    expect(sql).toContain(
      'ALTER DEFAULT PRIVILEGES FOR ROLE "app" IN SCHEMA public GRANT SELECT ON TABLES TO "catladder_readonly"',
    );
    expect(sql).not.toMatch(/INSERT|UPDATE|DELETE|ALL PRIVILEGES/);
    expect(sql).toContain("NOSUPERUSER NOCREATEDB NOCREATEROLE");
    expect(sql).toContain("default_transaction_read_only = on");
  });
  it("quotes identifiers and literals", () => {
    const evil = buildReadonlyRoleSql({
      role: "r",
      password: "p'w",
      database: 'd"b',
      appUser: "a",
    });
    expect(evil).toContain("PASSWORD 'p''w'");
    expect(evil).toContain('DATABASE "d""b"');
  });
});

describe("buildDropReadonlyRoleSql", () => {
  it("revokes the default privileges before dropping", () => {
    const sql = buildDropReadonlyRoleSql({ role: "r", appUser: "app" });
    expect(sql.indexOf("REVOKE")).toBeLessThan(sql.indexOf("DROP ROLE"));
  });
});

describe("getStaticDbName", () => {
  it("rejects names derived from the merge request", () => {
    expect(getStaticDbName("acme-shop-dev-web")).toBe("acme-shop-dev-web");
    expect(getStaticDbName("acme-shop-$CI_MERGE_REQUEST_IID-web")).toBe(
      undefined,
    );
    expect(getStaticDbName(undefined)).toBe(undefined);
  });
});

describe("syncLocalAccessDb", () => {
  it("creates the role and stores new credentials", async () => {
    const { io, manager, deps, sql } = setup({});
    await syncLocalAccessDb(io, context, "p:r:i", true, deps);
    expect(sql).toHaveLength(1);
    expect(sql[0]).toContain("CREATE ROLE");
    expect(manager.writeSecrets).toHaveBeenCalledTimes(1);
    const [, , secrets, , options] = manager.writeSecrets.mock.calls[0];
    const stored = JSON.parse(secrets.LOCAL_ACCESS_DB_DEV_CREDENTIALS);
    expect(stored).toMatchObject({
      user: "catladder_readonly",
      database: "acme-shop-dev-web",
      instanceConnectionName: "p:r:i",
    });
    expect(stored.password).toHaveLength(48);
    expect(options).toEqual({ backup: false });
  });

  it("keeps the stored password and writes nothing when unchanged", async () => {
    const stored = {
      user: "catladder_readonly",
      password: "stored",
      database: "acme-shop-dev-web",
      instanceConnectionName: "p:r:i",
    };
    const { io, manager, deps, sql } = setup({ stored });
    await syncLocalAccessDb(io, context, "p:r:i", true, deps);
    expect(sql[0]).toContain("PASSWORD 'stored'");
    expect(manager.writeSecrets).not.toHaveBeenCalled();
    expect(manager.cacheSecrets).toHaveBeenCalled();
  });

  it("is a no-op when nothing is declared and nothing stored", async () => {
    const { io, deps } = setup({});
    await syncLocalAccessDb(io, context, "p:r:i", false, deps);
    expect(deps.getAppCredentials).not.toHaveBeenCalled();
    expect(deps.runSql).not.toHaveBeenCalled();
  });

  it("drops the role when the declaration is gone", async () => {
    const { io, deps, sql } = setup({
      stored: { password: "stored", user: "catladder_readonly" },
    });
    await syncLocalAccessDb(io, context, "p:r:i", false, deps);
    expect(sql[0]).toContain("DROP ROLE");
  });

  it("skips envs whose database name is not known yet", async () => {
    const { io, deps, manager } = setup({
      database: "acme-$CI_MERGE_REQUEST_IID-web",
    });
    await syncLocalAccessDb(io, context, "p:r:i", true, deps);
    expect(deps.runSql).not.toHaveBeenCalled();
    expect(manager.writeSecrets).not.toHaveBeenCalled();
    expect(io.log).toHaveBeenCalledWith(expect.stringContaining("skipped"));
  });

  it("does not store credentials when the sql fails", async () => {
    const { io, deps, manager } = setup({});
    deps.runSql.mockRejectedValueOnce(new Error("psql failed"));
    await expect(
      syncLocalAccessDb(io, context, "p:r:i", true, deps),
    ).rejects.toThrow("psql failed");
    expect(manager.writeSecrets).not.toHaveBeenCalled();
  });
});
