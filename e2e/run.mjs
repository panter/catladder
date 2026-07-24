#!/usr/bin/env node
/**
 * catladder sandbox E2E runner (phase 1: manual invocation).
 *
 * Runs a fixture against the disposable sandbox project and asserts the
 * resulting REAL pipelines on the chosen backend — the layer snapshot
 * tests cannot see (published-package assets, runner permissions, token
 * flows, trigger wiring).
 *
 *   yarn e2e <fixture> --backend github|gitlab [--tgz <cli.tgz>]
 *            [--sandbox <dir>] [--static-only]
 *
 * The loop per backend:
 *   1. pack the cli from this checkout (or take --tgz)
 *   2. reset the sandbox checkout to the backend's main
 *   3. install the tgz, copy the fixture's catladder.ts (+ files/)
 *   4. run catenv, assert the fixture's static expectations
 *   5. restore package.json/yarn.lock from the backend's main (CI must
 *      not see the file: dependency), commit, push
 *   6. poll the backend API for the triggered pipeline and assert the
 *      fixture's runtime expectations (main run, tag run, dispatches)
 *
 * Sandbox repos (disposable, echo-only deploys — every run may cut a
 * real release there, that is their purpose):
 *   gitlab: catladder/release-sandbox   github: panter/catladder-release-sandbox
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const e2eDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(e2eDir, "..");

// ---------------------------------------------------------------- config

const SANDBOX = {
  dir: resolve(repoRoot, "../../catladder-release-sandbox"),
  gitlabProject: "catladder%2Frelease-sandbox",
  githubRepo: "panter/catladder-release-sandbox",
  remotes: { gitlab: "origin", github: "github" },
};

const POLL_SECONDS = 20;
const RUN_TIMEOUT_MINUTES = 25;

// ---------------------------------------------------------------- helpers

const args = process.argv.slice(2);
const fixtureName = args.find((a) => !a.startsWith("--"));
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1]?.startsWith("--") ? true : args[i + 1]) : undefined;
};
const has = (name) => args.includes(`--${name}`);

const log = (msg) => console.log(`\x1b[36m[e2e]\x1b[0m ${msg}`);
const fail = (msg) => {
  console.error(`\x1b[31m[e2e] ${msg}\x1b[0m`);
  process.exit(1);
};

const sh = (cmd, opts = {}) =>
  (
    execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }) ?? ""
  ).trim();
const shSandbox = (cmd) => sh(cmd, { cwd: SANDBOX.dir });
const shJson = (cmd, opts) => JSON.parse(sh(cmd, opts) || "null");

const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

// collected assertion results: {label, ok, detail}
const results = [];
const assert = (label, ok, detail = "") => {
  results.push({ label, ok, detail });
  console.log(`  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
};

/** compare actual job map {name → status} against expectation {name → expected} */
const assertJobs = (phase, expected, actual) => {
  for (const [name, want] of Object.entries(expected)) {
    const got = actual[name];
    if (want === "absent") {
      assert(`${phase}: ${name} absent`, got === undefined, `present with status ${got}`);
    } else {
      assert(`${phase}: ${name} = ${want}`, got === want, `got ${got ?? "absent"}`);
    }
  }
};

// ---------------------------------------------------------------- steps

const packCli = async () => {
  const given = flag("tgz");
  if (given) return resolve(String(given));
  log("packing @catladder/cli from this checkout (pass --tgz to skip)");
  sh("yarn workspace @catladder/pipeline build", { cwd: repoRoot, stdio: "inherit" });
  sh("yarn workspace @catladder/cli build", { cwd: repoRoot, stdio: "inherit" });
  const out = sh(`npm pack --pack-destination /tmp`, { cwd: join(repoRoot, "apps/cli") })
    .split("\n")
    .pop();
  return `/tmp/${out}`;
};

const prepareSandbox = (backend, tgz, fixtureDir) => {
  const remote = SANDBOX.remotes[backend];
  log(`resetting sandbox to ${remote}/main`);
  shSandbox(`git fetch ${remote}`);
  shSandbox(`git reset --hard ${remote}/main`);
  shSandbox(`git clean -fd`);
  log("installing packed cli");
  shSandbox(`yarn add -D @catladder/cli@file:${tgz}`);
  log("applying fixture");
  cpSync(join(fixtureDir, "catladder.ts"), join(SANDBOX.dir, "catladder.ts"));
  const extraFiles = join(fixtureDir, "files");
  if (existsSync(extraFiles)) cpSync(extraFiles, SANDBOX.dir, { recursive: true });
  log("generating (catenv)");
  sh(`node_modules/.bin/catenv`, { cwd: SANDBOX.dir, stdio: "inherit" });
};

const runStaticChecks = (checks = []) => {
  for (const { file, contains = [], notContains = [] } of checks) {
    const path = join(SANDBOX.dir, file);
    if (!existsSync(path)) {
      assert(`static: ${file} exists`, false);
      continue;
    }
    const content = readFileSync(path, "utf8");
    for (const s of contains) assert(`static: ${file} contains "${s}"`, content.includes(s));
    for (const s of notContains) assert(`static: ${file} lacks "${s}"`, !content.includes(s));
  }
};

const commitAndPush = (backend, label) => {
  const remote = SANDBOX.remotes[backend];
  // CI runs an immutable install of the committed manifest — it must
  // reference the published prerelease, not the local tgz
  shSandbox(`git checkout ${remote}/main -- package.json yarn.lock`);
  shSandbox(`git add -A`);
  shSandbox(`git -c core.hooksPath=/dev/null commit -m "e2e: ${label} (${backend})" --allow-empty`);
  shSandbox(`git push ${remote} HEAD:main`);
  return shSandbox(`git rev-parse HEAD`);
};

// ------------------------------------------------ github pipeline polling

const ghRunBySha = async (sha, workflow) => {
  for (let i = 0; i < 20; i++) {
    const runs = shJson(
      `gh run list -R ${SANDBOX.githubRepo} --workflow ${workflow} --limit 5 --json databaseId,headSha,status`,
    );
    const run = runs?.find((r) => r.headSha === sha);
    if (run) return run.databaseId;
    await sleep(6);
  }
  throw new Error(`no ${workflow} run appeared for ${sha}`);
};

const ghAwaitRun = async (id) => {
  const deadline = Date.now() + RUN_TIMEOUT_MINUTES * 60_000;
  for (;;) {
    const { status } = shJson(
      `gh run view ${id} -R ${SANDBOX.githubRepo} --json status`,
    );
    if (status === "completed") break;
    if (Date.now() > deadline) throw new Error(`run ${id} timed out`);
    log(`  … run ${id}: ${status}`);
    await sleep(POLL_SECONDS);
  }
  const { jobs } = shJson(
    `gh run view ${id} -R ${SANDBOX.githubRepo} --json jobs`,
  );
  return Object.fromEntries(jobs.map((j) => [j.name.trim(), j.conclusion ?? j.status]));
};

/** wait for a NEW tag run (created after `since`) of the release workflow */
const ghAwaitTagRun = async (since) => {
  for (let i = 0; i < 30; i++) {
    const runs = shJson(
      `gh run list -R ${SANDBOX.githubRepo} --workflow catladder-release.yml --limit 3 --json databaseId,createdAt,headBranch`,
    );
    const run = runs?.find((r) => new Date(r.createdAt).getTime() > since);
    if (run) {
      log(`tag run for ${run.headBranch}: ${run.databaseId}`);
      return ghAwaitRun(run.databaseId);
    }
    await sleep(10);
  }
  throw new Error("no tag-triggered release run appeared");
};

const ghDispatch = async (workflow, input) => {
  const inputs = Object.entries(input)
    .map(([k, v]) => `-f ${k}=${v}`)
    .join(" ");
  const since = Date.now();
  sh(`gh workflow run ${workflow} -R ${SANDBOX.githubRepo} --ref main ${inputs}`);
  for (let i = 0; i < 20; i++) {
    const runs = shJson(
      `gh run list -R ${SANDBOX.githubRepo} --workflow ${workflow} --limit 3 --json databaseId,createdAt`,
    );
    const run = runs?.find((r) => new Date(r.createdAt).getTime() > since - 15_000);
    if (run) return ghAwaitRun(run.databaseId);
    await sleep(6);
  }
  throw new Error(`dispatched ${workflow} run did not appear`);
};

// ------------------------------------------------ gitlab pipeline polling

const glPipelineBySha = async (sha) => {
  for (let i = 0; i < 20; i++) {
    const pipes = shJson(`glab api "projects/${SANDBOX.gitlabProject}/pipelines?sha=${sha}"`);
    if (pipes?.length) return pipes[0].id;
    await sleep(6);
  }
  throw new Error(`no gitlab pipeline appeared for ${sha}`);
};

const glAwaitPipeline = async (id, { settleOnManual = true } = {}) => {
  const deadline = Date.now() + RUN_TIMEOUT_MINUTES * 60_000;
  for (;;) {
    const { status } = shJson(`glab api "projects/${SANDBOX.gitlabProject}/pipelines/${id}"`);
    // "manual" = blocked on manual jobs — a settled state for assertions
    if (!["running", "pending", "created", "preparing", "waiting_for_resource"].includes(status)) {
      if (status !== "manual" || settleOnManual) break;
    }
    if (Date.now() > deadline) throw new Error(`pipeline ${id} timed out`);
    log(`  … pipeline ${id}: ${status}`);
    await sleep(POLL_SECONDS);
  }
  const jobs = shJson(`glab api "projects/${SANDBOX.gitlabProject}/pipelines/${id}/jobs?per_page=100"`);
  return Object.fromEntries(jobs.map((j) => [j.name.trim(), j.status === "success" ? "success" : j.status]));
};

/** wait for a NEW v* tag pipeline (created after `since`) */
const glAwaitTagPipeline = async (since) => {
  for (let i = 0; i < 30; i++) {
    const pipes = shJson(
      `glab api "projects/${SANDBOX.gitlabProject}/pipelines?per_page=10"`,
    );
    const pipe = pipes?.find(
      (p) => p.ref.startsWith("v") && new Date(p.created_at).getTime() > since,
    );
    if (pipe) {
      log(`tag pipeline for ${pipe.ref}: ${pipe.id}`);
      return glAwaitPipeline(pipe.id);
    }
    await sleep(10);
  }
  throw new Error("no tag pipeline appeared");
};

// ---------------------------------------------------------------- main

const main = async () => {
  if (!fixtureName) fail("usage: yarn e2e <fixture> --backend github|gitlab [--tgz <path>]");
  const fixtureDir = join(e2eDir, "fixtures", fixtureName);
  if (!existsSync(fixtureDir)) fail(`unknown fixture: ${fixtureName}`);
  const expectation = (await import(join(fixtureDir, "expect.mjs"))).default;

  const backends = String(flag("backend") ?? Object.keys(expectation).join(","))
    .split(",")
    .filter(Boolean);

  const tgz = has("static-only") ? flag("tgz") ?? (await packCli()) : await packCli();

  for (const backend of backends) {
    const expect = expectation[backend];
    if (!expect) {
      log(`fixture declares no expectations for ${backend} — skipping`);
      continue;
    }
    log(`\x1b[1m=== ${fixtureName} on ${backend} ===\x1b[0m`);
    prepareSandbox(backend, tgz, fixtureDir);
    runStaticChecks(expect.static);
    if (has("static-only")) continue;

    const startedAt = Date.now();
    const sha = commitAndPush(backend, fixtureName);
    log(`pushed ${sha.slice(0, 8)} — waiting for pipelines`);

    if (backend === "github") {
      if (expect.mainRun) {
        const jobs = await ghAwaitRun(await ghRunBySha(sha, "catladder-main.yml"));
        assertJobs("main", expect.mainRun.jobs, jobs);
      }
      if (expect.tagRun) {
        assertJobs("tag", expect.tagRun.jobs, await ghAwaitTagRun(startedAt));
      }
      for (const d of expect.dispatches ?? []) {
        log(`dispatch ${d.workflow} ${JSON.stringify(d.input)}`);
        assertJobs(`dispatch(${Object.values(d.input)})`, d.jobs, await ghDispatch(d.workflow, d.input));
      }
    } else {
      if (expect.mainPipeline) {
        const jobs = await glAwaitPipeline(await glPipelineBySha(sha));
        assertJobs("main", expect.mainPipeline.jobs, jobs);
      }
      if (expect.tagPipeline) {
        assertJobs("tag", expect.tagPipeline.jobs, await glAwaitTagPipeline(startedAt));
      }
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n[e2e] ${results.length - failed.length}/${results.length} assertions passed`);
  if (failed.length) {
    for (const f of failed) console.error(`  ✗ ${f.label}${f.detail ? ` — ${f.detail}` : ""}`);
    process.exit(1);
  }
};

main().catch((e) => fail(e.message));
