export const logError = (
  cmd: any,
  message: string,
  additionalMessage?: any
) => {
  cmd.log("");
  cmd.log(`[ERROR] 🙀 :${message}`);
  cmd.log("");
  if (additionalMessage) {
    cmd.log(additionalMessage);
    cmd.log("");
  }
};
