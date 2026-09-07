import { spawnSync } from "child_process";
import { mkdtemp, mkdir, realpath, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";
import {
  GENERATED_CATCI_FOLDER,
  makeCatciGeneratedFiles,
} from "../shippedCatci";

// stand-in for the real ncc bundle: commonjs that touches `__dirname`
// the same way ncc's asset-base line does (the real bundle needs a
// full cli build, which the test job does not run)
const FAKE_BUNDLE = 'console.log("catci-ok " + __dirname);\n';

describe("shipped catci", () => {
  it("materializes the bundle with a sibling package.json pinning commonjs", () => {
    const files = makeCatciGeneratedFiles(FAKE_BUNDLE);
    expect(files.map(({ path }) => path)).toEqual([
      join(GENERATED_CATCI_FOLDER, "index.js"),
      join(GENERATED_CATCI_FOLDER, "package.json"),
    ]);
    expect(files[0].content).toBe(FAKE_BUNDLE);
    expect(JSON.parse(files[1].content)).toEqual({ type: "commonjs" });
  });

  it("runs under a project whose root package.json declares type: module", async () => {
    // regression: node resolves the module format from the nearest
    // package.json. Without the sibling one, the bundle was parsed as
    // ESM in such projects and crashed with
    // "ReferenceError: __dirname is not defined in ES module scope"
    // realpath: node reports resolved paths (macOS tmpdir is a symlink)
    const root = await realpath(await mkdtemp(join(tmpdir(), "catci-esm-")));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "esm-consumer", type: "module" }),
    );
    for (const { path, content } of makeCatciGeneratedFiles(FAKE_BUNDLE)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), content);
    }
    const { status, stdout, stderr } = spawnSync(
      process.execPath,
      [join(GENERATED_CATCI_FOLDER, "index.js")],
      { cwd: root, encoding: "utf-8" },
    );
    expect(stderr).toBe("");
    expect(status).toBe(0);
    expect(stdout).toContain(`catci-ok ${join(root, GENERATED_CATCI_FOLDER)}`);
  });
});
