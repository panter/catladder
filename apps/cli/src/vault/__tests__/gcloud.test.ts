import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("child_process", () => ({ spawn }));

import { GcloudAuthError, runGcloud } from "../gcloud";

type FakeChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: EventEmitter & { end: ReturnType<typeof vi.fn> };
};

const fakeChild = (opts: {
  code: number;
  stdout?: string;
  stderr?: string;
}) => {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = Object.assign(new EventEmitter(), {
    end: vi.fn(() => {
      setImmediate(() => {
        if (opts.stdout) child.stdout.emit("data", Buffer.from(opts.stdout));
        if (opts.stderr) child.stderr.emit("data", Buffer.from(opts.stderr));
        child.emit("close", opts.code);
      });
    }),
  });
  spawn.mockReturnValue(child);
  return child;
};

beforeEach(() => {
  spawn.mockReset();
});

describe("runGcloud", () => {
  it("does not use a shell, is non-interactive and sends input via stdin", async () => {
    const child = fakeChild({ code: 0, stdout: "ok" });
    const result = await runGcloud(
      ["secrets", "versions", "add", "id", "--data-file=-"],
      "s3cret",
    );

    expect(result).toBe("ok");
    const [cmd, args, options] = spawn.mock.calls[0];
    expect(cmd).toBe("gcloud");
    expect(options.shell).toBeUndefined();
    expect(args).toContain("--quiet");
    expect(options.env.CLOUDSDK_CORE_DISABLE_PROMPTS).toBe("1");
    expect(args.join(" ")).not.toContain("s3cret");
    expect(child.stdin.end).toHaveBeenCalledWith("s3cret");
  });

  it("never leaks the secret value in a failure message", async () => {
    fakeChild({ code: 1, stderr: "ERROR: something broke" });
    const err = await runGcloud(["secrets", "create", "id"], "s3cret").catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("something broke");
    expect(err.message).not.toContain("s3cret");
  });

  it("maps PERMISSION_DENIED to GcloudAuthError", async () => {
    fakeChild({ code: 1, stderr: "PERMISSION_DENIED: nope" });
    await expect(runGcloud(["secrets", "list"])).rejects.toBeInstanceOf(
      GcloudAuthError,
    );
  });

  it("maps a missing login to GcloudAuthError", async () => {
    fakeChild({ code: 1, stderr: "Please run: gcloud auth login" });
    await expect(runGcloud(["secrets", "list"])).rejects.toBeInstanceOf(
      GcloudAuthError,
    );
  });
});
