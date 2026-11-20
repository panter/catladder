import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Config } from "@catladder/pipeline";
import { createComponentContext } from "@catladder/pipeline";
import type * as ProjectConfig from "../../../config/getProjectConfig";
import { commandLogs } from "../commandLogs";
import { runCommand } from "../../../core/runner";
import { getLocalAccessKeyFilePath } from "../../../localAccess/keyFiles";
import { getDeclaredLocalAccessEnvs } from "../../../localAccess/declared";
import { readLogEntries } from "../../../gcloud/logs/readLogs";
import {
  getProjectConfig,
  getPipelineContextByChoice,
} from "../../../config/getProjectConfig";

vi.mock("../../../config/getProjectConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof ProjectConfig>()),
  getProjectConfig: vi.fn(),
  getPipelineContextByChoice: vi.fn(),
}));
vi.mock("../../../localAccess/keyFiles", () => ({
  getLocalAccessKeyFilePath: vi.fn(),
}));
vi.mock("../../../localAccess/declared", () => ({
  getDeclaredLocalAccessEnvs: vi.fn(),
}));
vi.mock("../../../gcloud/logs/readLogs", () => ({ readLogEntries: vi.fn() }));

const config = {
  appName: "shop",
  customerName: "acme",
  store: { gcloudProjects: { p: { projectNumber: "123456789" } } },
  components: {
    web: {
      dir: ".",
      build: { type: "custom", buildCommand: "true" },
      deploy: {
        type: "google-cloudrun",
        projectId: "p",
        region: "europe-west6",
        service: {},
        jobs: { migrate: { image: "x", command: "true" } },
      },
    },
  },
} as unknown as Config;

beforeEach(() => {
  vi.mocked(getProjectConfig).mockResolvedValue(config);
  vi.mocked(getPipelineContextByChoice).mockImplementation(
    (env, componentName) =>
      createComponentContext({ config, env, componentName }),
  );
  vi.mocked(getDeclaredLocalAccessEnvs).mockReturnValue(["dev"]);
  vi.mocked(getLocalAccessKeyFilePath).mockResolvedValue("/key.json");
  vi.mocked(readLogEntries).mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

const run = (inputs: Record<string, unknown> = {}) =>
  runCommand(commandLogs, { inputs: { envComponent: "dev:web", ...inputs } });

describe("logs command", () => {
  it.each(["declaration", "key"])(
    "gives actionable guidance for a missing %s without prompting",
    async (missing) => {
      if (missing === "declaration")
        vi.mocked(getDeclaredLocalAccessEnvs).mockReturnValue([]);
      else vi.mocked(getLocalAccessKeyFilePath).mockResolvedValue(undefined);
      await expect(run()).rejects.toThrow(
        /presets: \["logs"\].*project setup.*catenv/,
      );
    },
  );

  it("lists valid components and environments", async () => {
    await expect(run({ envComponent: "dev:missing" })).rejects.toThrow(
      /unknown component.*known: web/,
    );
    await expect(run({ envComponent: "missing:web" })).rejects.toThrow(
      /unknown environment.*known:.*dev/,
    );
  });

  it("prints only a JSON array on stdout and uses the default time window", async () => {
    const entries = [{ timestamp: "t", textPayload: "hello" }];
    vi.mocked(readLogEntries).mockResolvedValue(entries);
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await run({ json: true });
    expect(stdout).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(stdout.mock.calls[0][0]))).toEqual(entries);
    expect(readLogEntries).toHaveBeenCalledWith(
      "/key.json",
      "p",
      expect.objectContaining({
        freshness: "PT1H",
        limit: 200,
        filter: expect.stringContaining('resource.type="cloud_run_revision"'),
      }),
    );
  });

  it("passes job execution, severity and time window filters to the reader", async () => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await run({
      job: "migrate",
      execution: "r8hjv",
      severity: "error",
      since: "30m",
      limit: 10,
      json: true,
    });
    expect(readLogEntries).toHaveBeenCalledWith("/key.json", "p", {
      freshness: "PT30M",
      limit: 10,
      filter:
        'resource.type="cloud_run_job" AND resource.labels.job_name="acme-shop-dev-web-migrate" AND labels."run.googleapis.com/execution_name"="acme-shop-dev-web-migrate-r8hjv" AND severity>=ERROR',
    });
  });
});
