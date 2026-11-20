import type { ComponentContext } from "@catladder/pipeline";
import {
  getCloudRunJobsWithNames,
  getServiceName,
  isOfDeployType,
} from "@catladder/pipeline";

export type LogTarget =
  | { kind: "service"; name: string }
  | { kind: "job"; name: string };

export const SEVERITIES = [
  "DEFAULT",
  "DEBUG",
  "INFO",
  "NOTICE",
  "WARNING",
  "ERROR",
  "CRITICAL",
  "ALERT",
  "EMERGENCY",
] as const;

const NAME_FORMAT = /^[a-z0-9][a-z0-9-]*$/;

/**
 * names are put into a logging filter, so anything but what cloud run
 * allows in a name is rejected rather than escaped
 */
const assertSafeName = (name: string, what: string) => {
  if (!NAME_FORMAT.test(name)) {
    throw new Error(`${what} '${name}' is not a valid cloud run name`);
  }
  return name;
};

/**
 * review envs resolve their slug (`mr12` / `pr112`) at ci runtime, so
 * the names of a context are bash expressions there. Locally the slug
 * has to be given.
 */
const resolveReviewSlug = (
  context: ComponentContext,
  name: string,
  reviewSlug: string | undefined,
) => {
  const slugExpression = context.environment.reviewSlug;
  if (slugExpression === null || slugExpression === undefined) return name;
  if (!reviewSlug) {
    throw new Error(
      `${context.env}:${context.name} is a review env, pass the review app with --review-slug (e.g. pr112 or mr12)`,
    );
  }
  return name
    .split(String(slugExpression).toLowerCase())
    .join(reviewSlug.toLowerCase());
};

/**
 * the cloud run service or job whose logs to read. Names come from the
 * same functions the deploy uses.
 */
export const resolveLogTarget = (
  context: ComponentContext,
  options: { job?: string; reviewSlug?: string } = {},
): LogTarget => {
  if (!isOfDeployType(context.deploy?.config, "google-cloudrun")) {
    throw new Error(
      `${context.env}:${context.name} is not deployed to google cloud run`,
    );
  }
  if (options.job) {
    const entry = getCloudRunJobsWithNames(context).find(
      (j) => j.jobName === options.job,
    );
    if (!entry) {
      const known = getCloudRunJobsWithNames(context).map((j) => j.jobName);
      throw new Error(
        `${context.env}:${context.name} has no job '${options.job}'${known.length ? `, known: ${known.join(", ")}` : ""}`,
      );
    }
    return {
      kind: "job",
      name: assertSafeName(
        resolveReviewSlug(
          context,
          String(entry.fullJobName),
          options.reviewSlug,
        ),
        "job name",
      ),
    };
  }
  return {
    kind: "service",
    name: assertSafeName(
      resolveReviewSlug(
        context,
        String(getServiceName(context)),
        options.reviewSlug,
      ),
      "service name",
    ),
  };
};

/**
 * the logging filter for a target. `execution` is a job execution id,
 * either complete (`<job>-r8hjv`) or just the suffix (`r8hjv`).
 */
export const buildLogFilter = (
  target: LogTarget,
  options: { execution?: string; severity?: string } = {},
): string => {
  const parts =
    target.kind === "service"
      ? [
          'resource.type="cloud_run_revision"',
          `resource.labels.service_name="${target.name}"`,
        ]
      : [
          'resource.type="cloud_run_job"',
          `resource.labels.job_name="${target.name}"`,
        ];

  if (options.execution) {
    if (target.kind !== "job") {
      throw new Error("--execution needs --job");
    }
    const execution = assertSafeName(
      options.execution.toLowerCase(),
      "execution",
    );
    const full = execution.startsWith(`${target.name}-`)
      ? execution
      : `${target.name}-${execution}`;
    parts.push(`labels."run.googleapis.com/execution_name"="${full}"`);
  }

  if (options.severity) {
    const severity = options.severity.toUpperCase();
    if (!(SEVERITIES as readonly string[]).includes(severity)) {
      throw new Error(
        `unknown severity '${options.severity}', known: ${SEVERITIES.join(", ")}`,
      );
    }
    parts.push(`severity>=${severity}`);
  }
  return parts.join(" AND ");
};

const SINCE_FORMAT = /^\d+[smhd]$/;

/** `1h`, `30m`, `2d`, `45s` to the iso 8601 duration gcloud `--freshness` takes */
export const parseSince = (since: string): string => {
  if (!SINCE_FORMAT.test(since)) {
    throw new Error(`--since '${since}' must look like 30m, 1h or 2d`);
  }
  const unit = since.slice(-1);
  const amount = since.slice(0, -1);
  return unit === "d" ? `P${amount}D` : `PT${amount}${unit.toUpperCase()}`;
};

type LogEntry = {
  timestamp?: string;
  receiveTimestamp?: string;
  severity?: string;
  textPayload?: string;
  jsonPayload?: { message?: unknown } & Record<string, unknown>;
  protoPayload?: { status?: { message?: string }; methodName?: string };
  httpRequest?: {
    requestMethod?: string;
    requestUrl?: string;
    status?: number;
  };
};

/** one line per entry: `<timestamp> <severity> <message>` */
export const formatLogEntry = (entry: LogEntry): string => {
  const message =
    entry.textPayload ??
    (typeof entry.jsonPayload?.message === "string"
      ? entry.jsonPayload.message
      : undefined) ??
    entry.protoPayload?.status?.message ??
    (entry.httpRequest
      ? `${entry.httpRequest.requestMethod} ${entry.httpRequest.requestUrl} ${entry.httpRequest.status}`
      : undefined) ??
    (entry.jsonPayload ? JSON.stringify(entry.jsonPayload) : "");
  return `${entry.timestamp ?? entry.receiveTimestamp ?? ""} ${(entry.severity ?? "DEFAULT").padEnd(7)} ${message}`.trimEnd();
};
