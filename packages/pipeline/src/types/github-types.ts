/**
 * minimal model of the github actions workflow yaml,
 * see https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions
 */

export type GithubStep = {
  name?: string;
  id?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  if?: string;
  shell?: string;
};

export type GithubService = {
  image: string;
  env?: Record<string, string>;
  ports?: string[];
  options?: string;
};

export type GithubJob = {
  name?: string;
  "runs-on": string;
  needs?: string[];
  container?:
    | {
        image: string;
        credentials?: { username: string; password: string };
      }
    | string;
  services?: Record<string, GithubService>;
  environment?: { name: string; url?: string } | string;
  env?: Record<string, string>;
  permissions?: Record<string, string>;
  if?: string;
  "continue-on-error"?: boolean;
  steps: GithubStep[];
};

export type GithubWorkflow = {
  name: string;
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  concurrency?: { group: string; "cancel-in-progress"?: boolean };
  env?: Record<string, string>;
  jobs: Record<string, GithubJob>;
};
