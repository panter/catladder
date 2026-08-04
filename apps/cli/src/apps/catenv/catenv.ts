import { getProjectConfig } from "../../config/getProjectConfig";
import { printVariables } from "./printVariables";
import type { Choice } from "./types";
import { printVerboseBanner } from "./verboseBanner";
import { writeDotEnvFiles } from "./writeDotEnvFiles";
import { writeDTsFiles } from "./writeEnvDTs";
import {
  createCatenvContext,
  generatePipelineFiles,
} from "@catladder/pipeline";
import type { SecretsMode } from "../../vault";
import { createNonInteractiveIO } from "../../adapters/nonInteractive";
import { createTerminalIO } from "../../adapters/terminal";

type Options = {
  verbose?: boolean;
  printVariables?: boolean;
  vaultMode?: SecretsMode;
  /**
   * whether prompting is allowed (token setup, vault unlock). Callers
   * pass the TTY detection result; direnv/turbo/CI runs come out false.
   */
  interactive?: boolean;
};
export default async (choice?: Choice, options?: Options) => {
  const config = await getProjectConfig();
  if (!config) {
    return;
  }

  const io = options?.interactive
    ? // logs still go to stderr: even on a TTY, stdout is reserved for
      // data (--print-variables) and may be piped
      createTerminalIO({
        interactive: true,
        logToStderr: true,
        vaultMode: options?.vaultMode,
      })
    : createNonInteractiveIO({ vaultMode: options?.vaultMode });
  const context = { ...createCatenvContext(config), io };
  if (options?.verbose) {
    printVerboseBanner();
  }

  await Promise.all([
    generatePipelineFiles(context),
    writeDotEnvFiles(context, choice),

    writeDTsFiles(context, choice),
    options?.printVariables
      ? printVariables(context, choice)
      : Promise.resolve(),
  ]);
};
