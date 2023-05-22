/**
 *
 * takes a command and removes the first keep lines from the output
 *
 * @param cmd the command, its stdout is then limited
 * @param removeFirstN how many lines to remove at the start of the command
 * @returns
 */
export const removeFirstLinesFromCommandOutput = (
  cmd: string,
  removeFirstN: number
) => (removeFirstN === 0 ? cmd : `${cmd} | tail -n +${removeFirstN + 1}`);
