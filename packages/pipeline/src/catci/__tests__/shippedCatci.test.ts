import { spawnSync } from "child_process";
import { mkdtemp, mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";
import {
  GENERATED_CATCI_FOLDER,
  getCatciGeneratedFiles,
} from "../shippedCatci";

describe("shipped catci", () => {
  it("materializes the bundle with a sibling package.json pinning commonjs", () => {
    const files = getCatciGeneratedFiles();
    const paths = files.map(({ path }) => path);
    expect(paths).toContain(join(GENERATED_CATCI_FOLDER, "index.js"));
    const packageJson = files.find(
      ({ path }) => path === join(GENERATED_CATCI_FOLDER, "package.json"),
    );
    expect(packageJson).toBeDefined();
    expect(JSON.parse(packageJson!.content)).toEqual({ type: "commonjs" });
  });

  it("runs under a project whose root package.json declares type: module", async () => {
    // regression: the ncc bundle uses `__dirname`; without the sibling
    // package.json node parsed it as ESM in such projects and crashed
    // with "ReferenceError: __dirname is not defined in ES module scope"
    const root = await mkdtemp(join(tmpdir(), "catci-esm-"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "esm-consumer", type: "module" }),
    );
    for (const { path, content } of getCatciGeneratedFiles()) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), content);
    }
    // without arguments catci prints its usage and exits 1 — the point
    // is that node gets as far as running it at all
    const { stdout, stderr } = spawnSync(
      process.execPath,
      [join(GENERATED_CATCI_FOLDER, "index.js")],
      { cwd: root, encoding: "utf-8" },
    );
    expect(stderr).not.toContain("ReferenceError");
    expect(stderr).not.toContain("ES module");
    expect(`${stdout}${stderr}`).toContain("catci — catladder CI companion");
  });
});
