import { getAllEnvs, isOfDeployType } from "@catladder/pipeline";
import { defineCommand } from "../../core/defineCommand";
import {
  getPipelineContextByChoice,
  getProjectConfig,
  parseChoice,
} from "../../config/getProjectConfig";
import { envAndComponents } from "../../apps/cli/commands/project/utils/autocompletions";
import {
  buildLogFilter,
  formatLogEntry,
  parseSince,
  resolveLogTarget,
} from "../../gcloud/logs/logQuery";
import { readLogEntries } from "../../gcloud/logs/readLogs";
import { getLocalAccessKeyFilePath } from "../../localAccess/keyFiles";
import { getDeclaredLocalAccessEnvs } from "../../localAccess/declared";
import { hasDeployType } from "../availability";

export const commandLogs = defineCommand({
  name: "logs",
  description:
    "print the Cloud Run logs of a service or job (read-only, with the local access key, no login needed)",
  group: "project",
  isAvailable: hasDeployType("google-cloudrun"),
  inputs: {
    envComponent: {
      type: "string",
      message: "environment:component",
      positional: true,
      choices: async () => envAndComponents(),
    },
    job: {
      type: "string",
      message: "read the logs of this cloud run job instead of the service",
      required: false,
    },
    execution: {
      type: "string",
      message:
        "only this job execution (id like r8hjv, or the full name); needs --job",
      required: false,
    },
    since: {
      type: "string",
      message: "how far back to look, e.g. 30m, 1h, 2d",
      default: "1h",
    },
    severity: {
      type: "string",
      message: "minimum severity, e.g. ERROR",
      required: false,
    },
    limit: {
      type: "number",
      message: "maximum number of entries (the newest ones)",
      default: 200,
    },
    reviewSlug: {
      type: "string",
      message: "review app of a review env, e.g. pr112 or mr12",
      required: false,
    },
    json: {
      type: "boolean",
      message: "print the log entries as a json array",
      default: false,
    },
  },
  execute: async (ctx) => {
    const envComponent = await ctx.get("envComponent");
    const { env, componentName } = parseChoice(envComponent);
    if (!componentName) {
      throw new Error("need env:component, e.g. dev:web");
    }
    const job = await ctx.get("job");
    const execution = await ctx.get("execution");
    const severity = await ctx.get("severity");
    const reviewSlug = await ctx.get("reviewSlug");
    const limit = await ctx.get("limit");
    const freshness = parseSince(await ctx.get("since"));
    const asJson = await ctx.get("json");

    const config = await getProjectConfig();
    if (!config?.components[componentName]) {
      throw new Error(
        `unknown component '${componentName}', known: ${Object.keys(config?.components ?? {}).join(", ")}`,
      );
    }
    const envs = getAllEnvs(config, componentName);
    if (!envs.includes(env)) {
      throw new Error(
        `unknown environment '${env}' for ${componentName}, known: ${envs.join(", ")}`,
      );
    }
    const context = await getPipelineContextByChoice(env, componentName);
    const deployConfig = context.deploy?.config;
    if (!isOfDeployType(deployConfig, "google-cloudrun")) {
      throw new Error(
        `${env}:${componentName} is not deployed to google cloud run`,
      );
    }

    if (!getDeclaredLocalAccessEnvs(config, componentName).includes(env)) {
      throw new Error(
        `no local access declared for ${env}:${componentName} — declare \`localAccess: { gcp: { presets: ["logs"] } }\` in catladder.ts and run \`catladder project setup\`, then \`catenv\``,
      );
    }
    const keyFile = await getLocalAccessKeyFilePath(env, componentName);
    if (!keyFile) {
      throw new Error(
        `no local access key for ${env}:${componentName} — declare \`localAccess: { gcp: { presets: ["logs"] } }\` in catladder.ts and run \`catladder project setup\`, then \`catenv\` (\`catenv --vault-mode refresh\` if it was set up on another machine)`,
      );
    }

    const target = resolveLogTarget(context, { job, reviewSlug });
    const filter = buildLogFilter(target, { execution, severity });

    const entries = await readLogEntries(keyFile, deployConfig.projectId, {
      filter,
      limit,
      freshness,
    });

    // stdout carries the logs only, so it can be piped
    if (asJson) {
      process.stdout.write(JSON.stringify(entries, null, 2) + "\n");
      return;
    }
    if (entries.length === 0) {
      console.error(
        `no log entries for ${target.kind} ${target.name} within ${await ctx.get("since")}`,
      );
      return;
    }
    for (const entry of entries) {
      process.stdout.write(formatLogEntry(entry) + "\n");
    }
  },
});
