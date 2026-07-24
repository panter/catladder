import type { IO } from "../../../core/types";
import {
  getPreference,
  hasPreference,
  setPreference,
} from "../../../utils/preferences";

const KEY = "googleAuthUserNumber";
export const getGoogleAuthUserNumber = async (io: IO) => {
  if (!(await hasPreference(KEY))) {
    io.log(
      "Please type in your google auth user number (0 if you have only one google account or maybe 1 if you have multiple)",
    );

    const authUserNumber = await io.promptDirect({
      type: "number",
      name: "authUserNumber",
      default: 0,
      message: "Auth user ",
    });
    await setPreference(KEY, authUserNumber);
  }
  return getPreference(KEY);
};
