import { getSecretVarName } from "@catladder/pipeline";
import { exec } from "child-process-promise";
import { has, isObject } from "lodash";
<<<<<<< Updated upstream
import memoizee from "memoizee";
=======
>>>>>>> Stashed changes
import fetch from "node-fetch";
import open from "open";
import type { CommandInstance } from "vorpal";
import { getPreference, hasPreference, setPreference } from "./preferences";

const TOKEN_KEY = "gitlab-personal-access-token";

export const hasGitlabToken = async () => await hasPreference(TOKEN_KEY);
export const setupGitlabToken = async (vorpal: CommandInstance) => {
  vorpal.log("");
  vorpal.log("☝ in order to access the api, we need a personal access token");
  vorpal.log("Its best to create one specifically for catladder");
  vorpal.log("");
  vorpal.log("☝ we open up the settings page for you!");
  vorpal.log("");
  const { shouldContinue } = await vorpal.prompt({
    default: true,
    message: "Ok",
    name: "shouldContinue",
    type: "prompt",
  });

  open("https://git.panter.ch/-/profile/personal_access_tokens");

  vorpal.log("Please type in gitlab's personal access token");

  const { personalToken } = await vorpal.prompt({
    type: "string",
    name: "personalToken",
    default: "",
    message: "Your personal access token ",
  });
  if (personalToken) {
    await setPreference(TOKEN_KEY, personalToken);
  }
};
export const getGitlabToken = async (vorpal: CommandInstance) => {
  if (!(await hasGitlabToken())) {
    if (!vorpal) {
      console.error(
        "⚠️ gitlab token missing, please run catladder to set it up"
      );
      process.exit(1);
    }
    await setupGitlabToken(vorpal);
  }
  return getPreference(TOKEN_KEY);
};

type Method = "GET" | "PUT" | "POST" | "DELETE";
export const doGitlabRequest = async <T = any>(
  vorpal: CommandInstance,
  path: string,
  data: any = undefined,
  method: Method = "GET"
): Promise<T> => {
  const rootToken = await getGitlabToken(vorpal);

  //const method = data ? (update ? "PUT" : "POST") : "GET";

  const result = await fetch(`https://git.panter.ch/api/v4/${path}`, {
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
    }".\nResponse: ${JSON.stringify(await result.json(), null, 2)}`
  );
};

export const getProjectInfo = async (
  vorpal: CommandInstance
): Promise<{ id: string; web_url: string }> => {
  const gitRemoteOriginUrl = (
    await exec("git config --get remote.origin.url")
  ).stdout.trim();
  const projectPath =
    /(https:\/\/|git@)git\.panter\.ch[:/]([^.]*)(\.git)?/g.exec(
      gitRemoteOriginUrl
    );
  const project = await doGitlabRequest(
    vorpal,
    `projects/${encodeURIComponent(projectPath[2])}`
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
const getAllVariables = async (
  vorpal: CommandInstance
): Promise<Array<GitlabVariable>> => {
  const { id } = await getProjectInfo(vorpal);
  let all: Array<GitlabVariable> = [];
  let result: Array<GitlabVariable>;
  let page = 1;
  do {
    result = await doGitlabRequest(
      vorpal,
      // 100 is max page size
      `projects/${id}/variables?per_page=100&page=${page}`
    );
    page++;
    all = [...all, ...result];
  } while (result?.length > 0);
  return all;
};

let getAllVariablesCachePromise: Promise<Array<GitlabVariable>>;
export const getAllVariablesMemoized = async (
  vorpal: CommandInstance
): Promise<Array<GitlabVariable>> => {
  if (!getAllVariablesCachePromise) {
    getAllVariablesCachePromise = getAllVariables(vorpal);
  }

  return await getAllVariablesCachePromise;
};

export const getVariableValueByRawName = async (
  vorpal: CommandInstance,
  rawName: string
) => {
  const allVariables = await getAllVariablesMemoized(vorpal);
  return allVariables.find((v) => v.key === rawName)?.value;
};

const maskableRegex = new RegExp("^[a-zA-Z0-9_+=/@:.~-]{8,}$"); // SEE https://gitlab.com/gitlab-org/gitlab-foss/-/blob/master/spec/frontend/ci_variable_list/components/ci_variable_modal_spec.js#L20
const isMaskable = (value: string): boolean => maskableRegex.test(value);

const createVariable = async (
  vorpal: CommandInstance,
  projectId: string,
  key: string,
  value: string,
  masked = true,
  environment_scope = "*"
) => {
  return await doGitlabRequest(
    vorpal,
    `projects/${projectId}/variables`,
    {
      key,
      value,
      masked: masked && isMaskable(value),
      environment_scope,
    },
    "POST"
  );
};

const updateVariable = async (
  vorpal: CommandInstance,
  projectId: string,
  key: string,
  value: string,
  masked = true
) => {
  return await doGitlabRequest(
    vorpal,
    `projects/${projectId}/variables/${key}`,
    {
      value,
      masked: masked && isMaskable(value),
    },
    "PUT"
  );
};

const deleteVariable = async (
  vorpal: CommandInstance,
  projectId: string,
  key: string
) => {
  return await doGitlabRequest(
    vorpal,
    `projects/${projectId}/variables/${key}`,
    undefined,
    "DELETE"
  );
};

const getAllCatladderEnvVarsInGitlab = async (vorpal: CommandInstance) => {
  const allVariables = await getAllVariablesMemoized(vorpal).then((v) =>
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
    }, {})
  );
  return allVariables;
};

<<<<<<< Updated upstream
const getBackupKey = (fullKey: string, timestamp: number) =>
  `${fullKey}_backup_${timestamp}`;
export const clearBackups = async (vorpal: CommandInstance, keep: number) => {
  const existingVariables = await getAllCatladderEnvVarsInGitlab(vorpal);
  const { id } = await getProjectInfo(vorpal);
  for (const [key, { backups }] of Object.entries(existingVariables)) {
    const backupsSorted = backups.sort((a, b) => b - a);
    //const toKeep = backupsSorted.slice(0, keep);
    const toDelete = backupsSorted.slice(keep);

    for (const timestamp of toDelete) {
      await deleteVariable(vorpal, id, getBackupKey(key, timestamp));
    }
  }
=======
const clearAllVariablesCache = () => {
  getAllVariablesCachePromise = null;
>>>>>>> Stashed changes
};

export const upsertAllVariables = async (
  vorpal: CommandInstance,
  variables: Record<string, any>,
  env: string,
  componentName: string,
  backup = true,
  masked = true // FIXME: would be better to have this per variable
): Promise<void> => {
  const { id } = await getProjectInfo(vorpal);

  // we list all existing variables. We also gather backup versions, but its currently unused
  const existingVariables = await getAllCatladderEnvVarsInGitlab(vorpal);
  for (const [key, value] of Object.entries(variables ?? {})) {
    const fullKey = getSecretVarName(env, componentName, key);
    const valueSanitized = isObject(value) ? JSON.stringify(value) : `${value}`;

    const exists = has(existingVariables, fullKey);
    const oldValue = existingVariables[fullKey]?.value;
    const changed = oldValue !== valueSanitized;
    if (changed) {
      if (exists) {
        vorpal.log(`changed: ${key}`);

        await updateVariable(vorpal, id, fullKey, valueSanitized, masked);
        // write backup
        if (backup) {
          await createVariable(
            vorpal,
            id,
            getBackupKey(fullKey, new Date().getTime()),
            oldValue,
            masked,
            "_backup"
          );
        }
      } else {
        vorpal.log(`new    : ${key}`);
        await createVariable(vorpal, id, fullKey, valueSanitized, masked);
      }
    } else {
      vorpal.log(`skip   : ${key}`);
    }
  }
  clearAllVariablesCache();
};
