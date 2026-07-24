import { describe, expect, it, vi, afterAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { readCatladderStore, CATLADDER_STORE_FILE } from "..";

const FIXTURES_DIR = join(__dirname, "__fixtures__");

function setupStore(name: string, content: string | null): string {
  const dir = join(FIXTURES_DIR, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  if (content !== null) {
    const storePath = join(dir, CATLADDER_STORE_FILE);
    mkdirSync(join(storePath, ".."), { recursive: true });
    writeFileSync(storePath, content);
  }
  return dir;
}

describe("readCatladderStore", () => {
  afterAll(() => rmSync(FIXTURES_DIR, { recursive: true, force: true }));

  it("returns an empty store when the file does not exist", () => {
    const dir = setupStore("missing", null);
    expect(readCatladderStore(dir)).toEqual({});
  });

  it("reads a valid store", () => {
    const dir = setupStore(
      "valid",
      "gcloudProjects:\n  my-project:\n    projectNumber: '123456'\n",
    );
    expect(readCatladderStore(dir)).toEqual({
      gcloudProjects: { "my-project": { projectNumber: "123456" } },
    });
  });

  it("warns and treats an invalid store as missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dir = setupStore(
      "invalid",
      "gcloudProjects:\n  my-project:\n    projectNumber: ''\n",
    );
    expect(readCatladderStore(dir)).toEqual({});
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("catladder project setup"),
    );
    warn.mockRestore();
  });

  it("warns and treats unparseable yaml as missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dir = setupStore("garbage", "{{{: not yaml");
    expect(readCatladderStore(dir)).toEqual({});
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
