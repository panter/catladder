import { exec } from "child-process-promise";
import { isObject, result } from "lodash";
import memoizee from "memoizee";
import fetch from "node-fetch";
import open from "open";
import { CommandInstance } from "vorpal";
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

export const doGitlabRequest = async <T = any>(
  vorpal: CommandInstance,
  path: string,
  data: any = undefined,
  update?: boolean
): Promise<T> => {
  const rootToken = await getGitlabToken(vorpal);

  const method = data ? (update ? "PUT" : "POST") : "GET";

  const result = await fetch(`https://git.panter.ch/api/v4/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Private-Token": rootToken,
    },
    body: JSON.stringify(data),
  });

  if (result.status >= 200 && result.status < 400) {
    return result.json();
  }

  console.trace(data);

  throw new Error(
    `Could not send request to gitlab api: ${result.status} "${
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
  const projectPath = /(https:\/\/|git@)git\.panter\.ch[:/](.*)\.git/g.exec(
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
export const getAllVariables = memoizee(
  async (vorpal: CommandInstance): Promise<Array<GitlabVariable>> => {
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
  },
  { promise: true }
);

const createVariable = async (
  vorpal: CommandInstance,
  projectId: string,
  key: string,
  value: string
) => {
  return await doGitlabRequest(vorpal, `projects/${projectId}/variables`, {
    key,
    value,
  });
};

const updateVariable = async (
  vorpal: CommandInstance,
  projectId: string,
  key: string,
  value: string
) => {
  return await doGitlabRequest(
    vorpal,
    `projects/${projectId}/variables/${key}`,
    {
      value,
    },
    true
  );
};
export const upsertAllVariables = async (
  vorpal: CommandInstance,
  variables: Record<string, any>,
  env: string,
  componentName: string
): Promise<void> => {
  const { id } = await getProjectInfo(vorpal);

  for (const [key, value] of Object.entries(variables ?? {})) {
    const fullKey = "CL_" + env + "_" + componentName + "_" + key;
    const valueSanitized = isObject(value) ? JSON.stringify(value) : `${value}`;
    try {
      await updateVariable(vorpal, id, fullKey, valueSanitized);
    } catch (e) {
      await createVariable(vorpal, id, fullKey, valueSanitized);
    } finally {
      getAllVariables.clear();
    }
  }
};
