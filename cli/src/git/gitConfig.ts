import { exec } from "child-process-promise";

export type GitLocationScope = "global" | "local" | "system" | "worktree";
export type GitConfigOptions = {
  location?: GitLocationScope;
  comment?: string;
};

const argsJoin = (args: (string | undefined)[]): string =>
  args.filter(Boolean).join(" ");

export async function gitConfigGet(
  key: string,
  { location }: Pick<GitConfigOptions, "location"> = {},
) {
  const { stdout } = await exec(
    `git config --get ${argsJoin([location ? `--${location}` : undefined])} ${key}`,
  );
  return stdout.trim();
}

export const gitConfigSet = (
  key: string,
  value: string,
  { location, comment }: GitConfigOptions = {},
) =>
  exec(
    `git config --set ${argsJoin([
      location ? `--${location}` : undefined,
      comment ? `--comment=${comment}` : undefined,
    ])} ${key} ${value}`,
  );
