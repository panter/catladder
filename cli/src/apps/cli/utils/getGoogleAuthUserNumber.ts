import {
  getPreference,
  hasPreference,
  setPreference,
} from "../../../utils/preferences";

const KEY = "googleAuthUserNumber";
export const getGoogleAuthUserNumber = async function () {
  if (!(await hasPreference(KEY))) {
    this.log(
      "Please type in your google auth user number (0 if you have only one google account or maybe 1 if you have multiple)",
    );

    const { authUserNumber } = await this.prompt({
      type: "number",
      name: "authUserNumber",
      default: "0",
      message: "Auth user ",
    });
    await setPreference(KEY, authUserNumber);
  }
  return getPreference(KEY);
};
