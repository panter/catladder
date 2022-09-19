import type { CommandInstance } from "vorpal";
import { getGoogleAuthUserNumber } from "../apps/cli/utils/getGoogleAuthUserNumber";
import open from "open";
export const openGoogleCloudDashboard = async (
  instance: CommandInstance,
  path: string,
  params: Record<string, string>
) => {
  const url = new URL("https://console.cloud.google.com/");
  url.pathname = path;
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const googleAuthUserNumber = await getGoogleAuthUserNumber.call(instance);
  url.searchParams.set("authuser", googleAuthUserNumber);

  open(url.toString());
};
