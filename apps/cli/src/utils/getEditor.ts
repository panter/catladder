import { spawn } from "child-process-promise";
import commandExists from "command-exists-promise";

let cmd: string;
export default async () => {
  if (!cmd) {
    cmd =
      process.env.VISUAL ??
      process.env.EDITOR ??
      ((await commandExists("code")) ? "code --wait" : "vim");
  }

  return {
    open: async (path: string) => {
      await spawn(`${cmd} ${path}`, { shell: true, stdio: "inherit" });
    },
  };
};
