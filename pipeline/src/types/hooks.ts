export type FileHookContext = {
  /**
   * the filename of the file
   */
  filename: string;
  /**
   * the extension of the file
   */
  extension: string;
  /**
   * the path of the file
   */
  path: string;

  /**
   * the content of the file
   */
  content: string;
};

type MaybePromise<T> = T | Promise<T>;
export type Hooks = {
  /**
   * transform the file before it is written. If undefined is returned, the file is not modified
   */
  transformFileBeforeWrite: (
    fileHookContext: FileHookContext,
  ) => MaybePromise<string | undefined>;
};
