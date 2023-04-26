import type { ReadStream } from "fs-extra";

declare module "child-process-promise" {
  function exec(
    cmd: string,
    options?: {
      env?: Record<string, string>;
    }
  ): Promise<{
    stdout: string;
  }>;

  type Stdio = "inherit" | "pipe";
  type SpawnOptions = {
    stdio?: Stdio | Stdio[];
    shell?: boolean | string;
    env?: Record<string, string>;
  };

  function spawn(
    cmd: string,
    options?: SpawnOptions
  ): Promise<{
    stdout: string;
  }>;

  function spawn(
    cmd: string,
    args: string[],
    options?: SpawnOptions
  ): Promise<unknown> & {
    childProcess: {
      stdout: ReadStream;
      kill: () => void;
    };
  };
}
