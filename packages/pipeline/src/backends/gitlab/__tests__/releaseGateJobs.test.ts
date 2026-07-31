import { describe, expect, it } from "vitest";
import { getReleaseGateJobNames } from "../releaseGateJobs";

type Job = {
  name: string;
  gitlabJob: { needs?: Array<string | { job: string }> };
};

const job = (name: string, needs: string[] = []): Job => ({
  name,
  gitlabJob: { needs: needs.map((n) => ({ job: n })) },
});

/**
 * THE invariant (the reason the executor may need only the sinks):
 * every automatic job must be awaited by the executor — either by being
 * in its needs directly, or by being an ancestor of a job that is.
 *
 * This deliberately does NOT assert which jobs are in the result: the
 * wiring (deploys needing tests, ...) may change; the property must not.
 */
const expectEveryAutoJobCovered = (autoJobs: Job[], gateNames: string[]) => {
  const byName = new Map(autoJobs.map((j) => [j.name, j]));
  // walk ancestors of the gate set: everything they (transitively) need
  const covered = new Set<string>();
  const queue = [...gateNames];
  while (queue.length > 0) {
    const name = queue.pop()!;
    if (covered.has(name)) continue;
    covered.add(name);
    for (const need of byName.get(name)?.gitlabJob.needs ?? []) {
      queue.push(typeof need === "string" ? need : need.job);
    }
  }
  for (const { name } of autoJobs) {
    expect(
      covered,
      `auto job "${name}" is not awaited by the executor`,
    ).toContain(name);
  }
};

describe("getReleaseGateJobNames", () => {
  it("needs only the tips of a build → deploy → verify chain", () => {
    const jobs = [
      job("image"),
      job("build", ["image"]),
      job("test", ["build"]),
      job("deploy", ["build", "test"]),
      job("verify", ["deploy"]),
    ];
    const gates = getReleaseGateJobNames(jobs);
    expect(gates).toEqual(["verify"]);
    expectEveryAutoJobCovered(jobs, gates);
  });

  it("keeps terminal quality jobs that nothing consumes", () => {
    const jobs = [
      job("build"),
      job("deploy", ["build"]),
      job("lint"),
      job("audit"),
    ];
    const gates = getReleaseGateJobNames(jobs);
    expect(gates.sort()).toEqual(["audit", "deploy", "lint"]);
    expectEveryAutoJobCovered(jobs, gates);
  });

  it("re-includes test automatically if deploys ever stop needing it", () => {
    // the "what if we change things around" case: deploy decoupled from
    // test ("deploy fast, test in parallel"). test loses its consumer,
    // becomes a sink, and re-enters the executor's needs BY ITSELF —
    // no explicit test-stage entry required.
    const coupled = [job("test"), job("deploy", ["test"])];
    expect(getReleaseGateJobNames(coupled)).toEqual(["deploy"]);

    const decoupled = [job("test"), job("deploy")];
    expect(getReleaseGateJobNames(decoupled).sort()).toEqual([
      "deploy",
      "test",
    ]);
    expectEveryAutoJobCovered(decoupled, getReleaseGateJobNames(decoupled));
  });

  it("treats a job consumed only by MANUAL jobs as a sink", () => {
    // the manual deploy is not in the auto set at all — its needs must
    // not hide the build from the executor, or a red build could no
    // longer block the release
    const autoJobs = [job("build"), job("test", ["build"])];
    // (a manual "deploy" needing "test" exists but is excluded upstream)
    const gates = getReleaseGateJobNames(autoJobs);
    expect(gates).toEqual(["test"]);
    expectEveryAutoJobCovered(autoJobs, gates);
  });

  it("supports plain-string needs entries", () => {
    const jobs = [
      { name: "a", gitlabJob: { needs: [] } },
      { name: "b", gitlabJob: { needs: ["a"] } },
    ];
    expect(getReleaseGateJobNames(jobs)).toEqual(["b"]);
  });

  it("covers diamonds without duplicating the tip", () => {
    const jobs = [
      job("build"),
      job("deploy-a", ["build"]),
      job("deploy-b", ["build"]),
      job("verify", ["deploy-a", "deploy-b"]),
    ];
    const gates = getReleaseGateJobNames(jobs);
    expect(gates).toEqual(["verify"]);
    expectEveryAutoJobCovered(jobs, gates);
  });
});
