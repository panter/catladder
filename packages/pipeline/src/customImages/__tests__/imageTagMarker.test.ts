import { describe, expect, it, vi } from "vitest";
import type * as HashModule from "../hash";
import type { ImageHashConfig } from "../hash";
import { GENERATED_IMAGES_FOLDER, JobImagesPlan } from "../jobImagesPlan";

// stands in for a bump of the shipped image hash salt
const salt = vi.hoisted(() => ({ extra: "" }));

vi.mock("../hash", async (importOriginal) => {
  const original = await importOriginal<typeof HashModule>();
  return {
    ...original,
    computeCustomImageHash: (config: ImageHashConfig) =>
      original.computeCustomImageHash({
        ...config,
        salt: `${config.salt ?? ""}${salt.extra}`,
      }),
  };
});

const generate = (extraSalt: string) => {
  salt.extra = extraSalt;
  const plan = new JobImagesPlan("gitlab");
  const { image } = plan.resolveRef({ catladderImage: "jobs-default" });
  const files = new Map(
    plan.getGeneratedFiles().map(({ path, content }) => [path, content]),
  );
  return { image, files };
};

describe("shipped image salt bump", () => {
  it("changes a materialized file, so gitlab's rules:changes rebuilds the image", () => {
    const before = generate("");
    const after = generate("-bumped");

    // the tag changed while the shipped definition stayed identical
    expect(after.image).not.toBe(before.image);
    const changed = [...after.files.keys()].filter(
      (path) => after.files.get(path) !== before.files.get(path),
    );
    expect(changed).toEqual([
      `${GENERATED_IMAGES_FOLDER}/jobs-default/IMAGE_TAG`,
    ]);
  });

  it("keeps the tag stable across generations (the marker is not hashed)", () => {
    expect(generate("").image).toBe(generate("").image);
  });
});
