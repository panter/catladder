import { describe, expect, it } from "vitest";
import { getNodeModulesCache, getYarnCache } from "../cache";

const yarnInfo = (extra: Record<string, unknown> = {}) =>
  Promise.resolve({
    type: "yarn",
    version: "4.0.0",
    isClassic: false,
    workspaces: [],
    ...extra,
  } as any);

describe("node caches", () => {
  it("standalone component uses its own build dir", async () => {
    const context: any = {
      type: "component",
      build: { type: "standalone", dir: "apps/www" },
      packageManagerInfo: yarnInfo({ componentIsInWorkspace: false }),
    };
    const [yarn] = await getYarnCache(context);
    const [nm] = await getNodeModulesCache(context);
    expect(yarn).toMatchObject({ buildDir: "apps/www", key: "yarn" });
    expect(nm).toMatchObject({
      key: "appswww-node-modules",
      keyFiles: ["apps/www/yarn.lock"],
      paths: ["apps/www/node_modules", "apps/www/.yarn/install-state.gz"],
    });
  });

  it("workspace-context job uses the workspace build dir (unchanged keys)", async () => {
    const context: any = {
      type: "workspace",
      build: { type: "workspace", dir: "." },
      packageManagerInfo: yarnInfo(),
    };
    const [yarn] = await getYarnCache(context);
    const [nm] = await getNodeModulesCache(context);
    expect(yarn).toMatchObject({ buildDir: ".", key: "yarn" });
    expect(nm).toMatchObject({
      key: ".-node-modules",
      keyFiles: ["yarn.lock"],
      paths: ["node_modules", ".yarn/install-state.gz"],
    });
  });

  it("component in a workspace shares the workspace's cache slots", async () => {
    // e.g. the verify and docker jobs of a fromWorkspace component:
    // they must read exactly what the workspace build job saves
    const context: any = {
      type: "component",
      build: {
        type: "fromWorkspace",
        dir: "apps/www",
        workspaceBuildConfig: {},
      },
      packageManagerInfo: yarnInfo({ componentIsInWorkspace: true }),
    };
    const [yarn] = await getYarnCache(context);
    const [nm] = await getNodeModulesCache(context);
    // identical to the workspace-context job above
    expect(yarn).toMatchObject({ buildDir: ".", key: "yarn" });
    expect(nm).toMatchObject({
      key: ".-node-modules",
      keyFiles: ["yarn.lock"],
      paths: ["node_modules", ".yarn/install-state.gz"],
    });
  });
});
