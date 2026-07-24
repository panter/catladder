export type BaseHookContext = {
  /**
   * the filename of the file
   */
  filename: string;
  /**
   * the path of the file
   */
  path: string;

  /**
   * the extension of the file
   */
  extension: string;
};
export type YamlHookContext = BaseHookContext & {
  data: any;
};
export type FileHookContext = BaseHookContext & {
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
  transformFileBeforeWrite?: (
    fileHookContext: FileHookContext,
  ) => MaybePromise<string | undefined>;

  /**
   * transform the yaml before it is written. If undefined is returned, the yaml is not modified
   */
  transformYamlBeforeWrite?: (
    fileHookContext: YamlHookContext,
  ) => MaybePromise<any | undefined>;
};
