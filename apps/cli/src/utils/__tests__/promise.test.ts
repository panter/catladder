import { describe, expect, it, vi } from "vitest";
import { retryWithBackoff } from "../promise";

describe("retryWithBackoff", () => {
  it("retries retryable errors until it succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("does not exist"))
      .mockRejectedValueOnce(new Error("does not exist"))
      .mockResolvedValue("ok");
    const onRetry = vi.fn();
    await expect(
      retryWithBackoff(fn, {
        shouldRetry: () => true,
        initialDelayMs: 1,
        onRetry,
      }),
    ).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry.mock.calls.map(([, , delayMs]) => delayMs)).toEqual([1, 2]);
  });

  it("throws non-retryable errors right away", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("permission denied"));
    await expect(
      retryWithBackoff(fn, { shouldRetry: () => false, initialDelayMs: 1 }),
    ).rejects.toThrow("permission denied");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after the given number of retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("does not exist"));
    await expect(
      retryWithBackoff(fn, {
        shouldRetry: () => true,
        retries: 2,
        initialDelayMs: 1,
      }),
    ).rejects.toThrow("does not exist");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
