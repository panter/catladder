import { describe, it, expect } from "vitest";
import { computeCustomImageHash } from "../hash";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const FIXTURES_DIR = join(__dirname, "__fixtures__");

function setupFixture(name: string, files: Record<string, string>): string {
  const dir = join(FIXTURES_DIR, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(dir, path);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content);
  }
  return dir;
}

function cleanupFixtures() {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
}

describe("computeCustomImageHash", () => {
  afterAll(cleanupFixtures);

  it("should produce a 12-character hex hash", () => {
    const dir = setupFixture("basic", {
      Dockerfile: "FROM node:20\nRUN echo hello\n",
    });
    const result = computeCustomImageHash({ dir });
    expect(result.hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it("should produce consistent hashes for the same content", () => {
    const dir = setupFixture("consistent", {
      Dockerfile: "FROM node:20\n",
    });
    const result1 = computeCustomImageHash({ dir });
    const result2 = computeCustomImageHash({ dir });
    expect(result1.hash).toBe(result2.hash);
  });

  it("should produce different hashes for different Dockerfile content", () => {
    const dir1 = setupFixture("diff1", {
      Dockerfile: "FROM node:20\n",
    });
    const dir2 = setupFixture("diff2", {
      Dockerfile: "FROM node:22\n",
    });
    const result1 = computeCustomImageHash({ dir: dir1 });
    const result2 = computeCustomImageHash({ dir: dir2 });
    expect(result1.hash).not.toBe(result2.hash);
  });

  it("should include additional files in the hash", () => {
    const dir1 = setupFixture("extra1", {
      Dockerfile: "FROM node:20\nCOPY script.sh .\n",
      "script.sh": "echo hello",
    });
    const dir2 = setupFixture("extra2", {
      Dockerfile: "FROM node:20\nCOPY script.sh .\n",
      "script.sh": "echo world",
    });
    const result1 = computeCustomImageHash({ dir: dir1 });
    const result2 = computeCustomImageHash({ dir: dir2 });
    expect(result1.hash).not.toBe(result2.hash);
  });

  it("should include buildArgs in the hash", () => {
    const dir = setupFixture("buildargs", {
      Dockerfile: "ARG VERSION\nFROM node:$VERSION\n",
    });
    const result1 = computeCustomImageHash({
      dir,
      buildArgs: { VERSION: "20" },
    });
    const result2 = computeCustomImageHash({
      dir,
      buildArgs: { VERSION: "22" },
    });
    expect(result1.hash).not.toBe(result2.hash);
  });

  it("should produce deterministic hashes regardless of buildArgs order", () => {
    const dir = setupFixture("buildargs-order", {
      Dockerfile: "FROM node:20\n",
    });
    const result1 = computeCustomImageHash({
      dir,
      buildArgs: { A: "1", B: "2" },
    });
    const result2 = computeCustomImageHash({
      dir,
      buildArgs: { B: "2", A: "1" },
    });
    expect(result1.hash).toBe(result2.hash);
  });

  it("should return watched paths including dir glob", () => {
    const dir = setupFixture("watched", {
      Dockerfile: "FROM node:20\n",
    });
    const result = computeCustomImageHash({ dir });
    expect(result.watchedPaths).toContain(`${dir}/**/*`);
  });

  it("should include hashExtraPaths in watched paths", () => {
    const dir = setupFixture("extra-watched", {
      Dockerfile: "FROM node:20\n",
    });
    const extraFile = join(FIXTURES_DIR, "shared-config.xml");
    writeFileSync(extraFile, "<config/>");

    const result = computeCustomImageHash({
      dir,
      hashExtraPaths: [extraFile],
    });
    expect(result.watchedPaths).toContain(extraFile);
  });

  it("should include hashExtraPaths content in the hash", () => {
    const dir = setupFixture("extra-hash", {
      Dockerfile: "FROM node:20\n",
    });
    const extraFile1 = join(FIXTURES_DIR, "extra1.txt");
    const extraFile2 = join(FIXTURES_DIR, "extra2.txt");
    writeFileSync(extraFile1, "content A");
    writeFileSync(extraFile2, "content B");

    const result1 = computeCustomImageHash({
      dir,
      hashExtraPaths: [extraFile1],
    });
    const result2 = computeCustomImageHash({
      dir,
      hashExtraPaths: [extraFile2],
    });
    expect(result1.hash).not.toBe(result2.hash);
  });
});
