export type PartialDeep<T> = T extends any[]
  ? T
  : T extends Record<string, any>
    ? {
        [P in keyof T]?: PartialDeep<T[P]>;
      }
    : T;
