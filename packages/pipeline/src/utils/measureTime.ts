import crypto from "crypto";
export const measureTime = (
  logLevel: string,
  label: string,
  meta: Record<string, any>,
) => {
  const shortId = crypto.randomUUID().slice(0, 8);
  const start = performance.now();

  let logMeta = { ...meta };
  const addMeta = (meta: Record<string, any>) => {
    logMeta = {
      ...logMeta,
      ...meta,
    };
  };

  console.log(logLevel, `[${shortId}] [START] ${label} `, {
    shortId,
    ...logMeta,
  });

  let disposed = false;

  const done = () => {
    if (disposed) return;
    disposed = true;

    const durationMs = Math.round(performance.now() - start);
    const durationS = `${durationMs / 1000}s`;
    console.log(logLevel, `[${shortId}] [END] ${label} | ${durationS}`, {
      shortId,
      durationS,
      ...logMeta,
    });
  };

  return {
    done,
    [Symbol.dispose]: done,
    addMeta,
  };
};
