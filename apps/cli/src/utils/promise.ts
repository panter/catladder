export async function filter<T>(
  arr: T[],
  iterator: (item: T) => Promise<boolean>,
) {
  const fail = Symbol("fail");
  return (
    await Promise.all(
      arr.map(async (item) => ((await iterator(item)) ? item : fail)),
    )
  ).filter((i) => i !== fail) as any as Promise<T[]>;
}

export const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * retries `fn` with exponential backoff while `shouldRetry` holds for
 * the thrown error (e.g. gcloud's eventual consistency right after
 * creating a resource)
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  {
    shouldRetry,
    retries = 6,
    initialDelayMs = 2000,
    onRetry,
  }: {
    shouldRetry: (error: unknown) => boolean;
    retries?: number;
    initialDelayMs?: number;
    onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  },
): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt > retries || !shouldRetry(error)) throw error;
      const delayMs = initialDelayMs * 2 ** (attempt - 1);
      onRetry?.(error, attempt, delayMs);
      await delay(delayMs);
    }
  }
};
