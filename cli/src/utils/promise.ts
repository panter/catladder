export async function filter<T>(
  arr: T[],
  iterator: (item: T) => Promise<boolean>
) {
  const fail = Symbol("fail");
  return ((await Promise.all(
    arr.map(async item => ((await iterator(item)) ? item : fail))
  )).filter(i => i !== fail) as any) as Promise<T[]>;
}

export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
