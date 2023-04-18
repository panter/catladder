import { exec } from "child-process-promise";

export const getBuildId = async () =>
  await exec("git describe --tags || git rev-parse HEAD").then((s) =>
    s.stdout.trim()
  );

// thx chat gpt
/**
 * returns the last tagged version string Major.minor.patch
 * returns 0.0.0 if there is no tag
 */
export const getCurrentVersionString = async () => {
  return await exec(
    'latest_tag=$(git describe --tags --abbrev=0 2>/dev/null); if [ -z "$latest_tag" ]; then echo "0.0.0"; else echo "${latest_tag#v}"; fi | cut -d "." -f 1-3'
  ).then((s) => s.stdout.trim());
};
