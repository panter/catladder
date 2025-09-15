import { exec } from "child-process-promise";
export const getMainBranch = async () => {
  const { stdout } = await exec("git rev-parse --abbrev-ref HEAD");
  return stdout.trim();
};
