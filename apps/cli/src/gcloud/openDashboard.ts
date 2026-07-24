import type { IO } from "../core/types";
import { getGoogleAuthUserNumber } from "../apps/cli/utils/getGoogleAuthUserNumber";
import open from "open";
export const openGoogleCloudDashboard = async (
  instance: IO,
  path: string,
  params: Record<string, string>,
) => {
  const url = new URL("https://console.cloud.google.com/");
  url.pathname = path;
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const googleAuthUserNumber = await getGoogleAuthUserNumber(instance);
  url.searchParams.set("authuser", googleAuthUserNumber);

  open(url.toString());
};
