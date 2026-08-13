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
/**
 * Transform hooks are a last-resort escape hatch: they rewrite the
 * generated output right before it is written, so they depend on the
 * exact shape of catladder's output and a catladder upgrade can break
 * them silently. Prefer a first-class config option whenever one exists.
 *
 * If you need a hook, please raise an issue on
 * https://github.com/panter/catladder/issues describing the use
 * case. This feedback helps us generalize it into a supported feature.
 */
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
