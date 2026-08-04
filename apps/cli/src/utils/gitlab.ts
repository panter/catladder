import { getSecretVarName } from "@catladder/pipeline";
import { has, isObject } from "lodash-es";
import memoizee from "memoizee";
import fetch from "node-fetch";
import open from "open";
import type { IO } from "../core/types";
import { getPreference, hasPreference, setPreference } from "./preferences";
import { getGitRemoteHostAndPath } from "../git/gitProjectInformation";

const TOKEN_KEY = "gitlab-personal-access-token";

export const hasGitlabToken = async () => await hasPreference(TOKEN_KEY);
export const setupGitlabToken = async (io: IO) => {
  io.log("");
  io.log("☝ in order to access the api, we need a personal access token");
  io.log("Its best to create one specifically for catladder");
  io.log("Scopes needed: api");
  io.log("");
  io.log("☝ we open up the settings page for you!");
  io.log("");
  const [shouldContinue, { gitRemoteHost }] = await Promise.all([
    io.confirm("Ok"),
    getGitRemoteHostAndPath(),
  ]);

  open(`https://${gitRemoteHost}/-/user_settings/personal_access_tokens`);

  io.log("Please type in gitlab's personal access token");

  const personalToken = await io.promptDirect({
    type: "string",
    name: "personalToken",
    default: "",
    message: "Your personal access token ",
  });
  if (personalToken) {
    await setPreference(TOKEN_KEY, personalToken);
  }
};
export const getGitlabToken = async (io: IO | null) => {
  if (!(await hasGitlabToken())) {
    if (!io) {
      console.error(
        "⚠️ gitlab token missing, please run catladder to set it up",
      );
      process.exit(1);
    }
    if (!io.interactive) {
      // don't start the setup wizard in a context that cannot prompt
      // (direnv, turbo, CI) — fail with the remedy instead
      throw new Error(
        "gitlab token missing — run `catenv` (or any `catladder` command) once in a terminal to set it up",
      );
    }
    await setupGitlabToken(io);
  }
  return getPreference(TOKEN_KEY);
};

type Method = "GET" | "PUT" | "POST" | "DELETE";
export const doGitlabRequest = async <T = any>(
  io: IO | null,
  path: string,
  data: any = undefined,
  method: Method = "GET",
): Promise<T> => {
  const [rootToken, { gitRemoteHost }] = await Promise.all([
    getGitlabToken(io),
    getGitRemoteHostAndPath(),
  ]);

  //const method = data ? (update ? "PUT" : "POST") : "GET";

  const result = await fetch(`https://${gitRemoteHost}/api/v4/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Private-Token": rootToken,
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (result.status >= 200 && result.status < 400) {
    if (result.headers.get("content-type") === "application/json") {
      return result.json();
    }
    return null;
  }
  if (result.status === 404) {
    throw new Error("not found");
  }

  throw new Error(
    `Could not send request to gitlab api ${path}: ${result.status} "${
      result.statusText
    }".\nResponse: ${JSON.stringify(await result.json(), null, 2)}`,
  );
};

/**
 * GET a list endpoint across ALL pages (gitlab returns 20 items per
 * page by default — long-lived projects easily exceed that, e.g.
 * rotated access tokens accumulate one entry per rotation)
 */
export const doGitlabRequestAllPages = async <T = any>(
  io: IO | null,
  path: string,
): Promise<T[]> => {
  const PER_PAGE = 100;
  const separator = path.includes("?") ? "&" : "?";
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const items = await doGitlabRequest<T[]>(
      io,
      `${path}${separator}per_page=${PER_PAGE}&page=${page}`,
    );
    if (!items?.length) break;
    all.push(...items);
    if (items.length < PER_PAGE) break;
  }
  return all;
};

export const getProjectInfo = async (
  io: IO | null,
): Promise<{ id: string; web_url: string }> => {
  const { gitRemotePath } = await getGitRemoteHostAndPath();
  const project = await doGitlabRequest(
    io,
    `projects/${encodeURIComponent(gitRemotePath)}`,
  );
  return project;
};

type GitlabVariable = {
  variable_type: string;
  key: string;
  value: string;
  protected: boolean;
  masked: boolean;
  environment_scope: string;
};
export const getAllVariables = memoizee(
  async (
    io: IO | null,
    n = 5, // how many requests to do in parallel, 5 seems a good value for many projects, ideally we would do one request in parallel per component
  ): Promise<Array<GitlabVariable>> => {
    const { id } = await getProjectInfo(io);

    let all: Array<GitlabVariable> = [];
    let result: Array<Array<GitlabVariable>> = [];
    let page = 1;

    do {
      // Create an array of promises for N pages
      const promises = Array.from({ length: n }, (_, i) => {
        return doGitlabRequest(
          io,
          `projects/${id}/variables?per_page=100&page=${page + i}`,
        );
      });

      // Wait for all promises to resolve
      result = await Promise.all(promises);

      // Increment the page by N
      page += n;

      // Flatten the result array and add it to 'all'
      all = [...all, ...result.flat()];
      // Continue only if the last page had results
    } while (result.length > 0 && result[result.length - 1].length > 0);

    return all;
  },
  { promise: true },
);

export const getVariableValueByRawName = async (io: IO, rawName: string) => {
  const allVariables = await getAllVariables(io);
  return allVariables.find((v) => v.key === rawName)?.value;
};

const maskableRegex = new RegExp("^[a-zA-Z0-9_+=/@:.~-]{8,}$"); // SEE https://gitlab.com/gitlab-org/gitlab-foss/-/blob/master/spec/frontend/ci_variable_list/components/ci_variable_modal_spec.js#L20
const isMaskable = (value: string): boolean => maskableRegex.test(value);

const createVariable = async (
  io: IO,
  projectId: string,
  key: string,
  value: string,
  masked = true,
  environment_scope = "*",
) => {
  return await doGitlabRequest(
    io,
    `projects/${projectId}/variables`,
    {
      key,
      value,
      masked: masked && isMaskable(value),
      environment_scope,
    },
    "POST",
  );
};

const updateVariable = async (
  io: IO,
  projectId: string,
  key: string,
  value: string,
  masked = true,
) => {
  return await doGitlabRequest(
    io,
    `projects/${projectId}/variables/${key}`,
    {
      value,
      masked: masked && isMaskable(value),
    },
    "PUT",
  );
};

const deleteVariable = async (io: IO, projectId: string, key: string) => {
  return await doGitlabRequest(
    io,
    `projects/${projectId}/variables/${key}`,
    undefined,
    "DELETE",
  );
};

const getAllCatladderEnvVarsInGitlab = async (io: IO) => {
  const allVariables = await getAllVariables(io).then((v) =>
    v.reduce<{
      [key: string]: {
        value?: string;
        backups: number[];
      };
    }>((acc, variable) => {
      const { key } = variable;

      if (key.startsWith("CL_")) {
        const matchBackup = key.match(/(CL_.*)_backup_([0-9]+)/);

        if (matchBackup) {
          const key = matchBackup[1];
          const timestamp = Number(matchBackup[2]);
          const backups = [...(acc[key]?.backups ?? []), timestamp];
          return {
            ...acc,
            [key]: {
              ...(acc[key] ?? {}), // add value
              backups,
            },
          };
        }

        return {
          ...acc,
          [key]: {
            backups: [],
            ...(acc[key] ?? {}), // may add backups
            value: variable.value,
          },
        };
      }

      return acc;
    }, {}),
  );
  return allVariables;
};

const getBackupKey = (fullKey: string, timestamp: number) =>
  `${fullKey}_backup_${timestamp}`;
export const clearBackups = async (io: IO, keep: number) => {
  const existingVariables = await getAllCatladderEnvVarsInGitlab(io);
  const { id } = await getProjectInfo(io);
  for (const [key, { backups }] of Object.entries(existingVariables)) {
    const backupsSorted = backups.sort((a, b) => b - a);
    //const toKeep = backupsSorted.slice(0, keep);
    const toDelete = backupsSorted.slice(keep);

    for (const timestamp of toDelete) {
      await deleteVariable(io, id, getBackupKey(key, timestamp));
    }
  }
};

export const upsertAllVariables = async (
  io: IO,
  variables: Record<string, any>,
  env: string,
  componentName: string,
  backup = true,
  masked = true, // FIXME: would be better to have this per variable
): Promise<void> => {
  const { id } = await getProjectInfo(io);

  // we list all existing variables. We also gather backup versions, but its currently unused
  const existingVariables = await getAllCatladderEnvVarsInGitlab(io);
  for (const [key, value] of Object.entries(variables ?? {})) {
    const fullKey = getSecretVarName(env, componentName, key);
    const valueSanitized = isObject(value) ? JSON.stringify(value) : `${value}`;

    const exists = has(existingVariables, fullKey);
    const oldValue = existingVariables[fullKey]?.value;
    const changed = oldValue !== valueSanitized;
    if (changed) {
      if (exists) {
        io.log(`changed: ${key}`);

        await updateVariable(io, id, fullKey, valueSanitized, masked);
        // write backup
        if (backup) {
          await createVariable(
            io,
            id,
            getBackupKey(fullKey, new Date().getTime()),
            oldValue,
            masked,
            "_backup",
          );
        }
      } else {
        io.log(`new    : ${key}`);
        await createVariable(io, id, fullKey, valueSanitized, masked);
      }
    } else {
      io.log(`skip   : ${key}`);
    }
  }
  getAllVariables.clear();
};
