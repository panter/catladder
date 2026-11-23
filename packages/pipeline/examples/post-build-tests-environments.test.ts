import { it, expect } from "vitest";
import {
  createYamlGithubWorkflows,
  createYamlLocalPipeline,
} from "./__utils__/helpers";
import config from "./post-build-tests-environments";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for post-build-tests-environments local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});

it("matches snapshot for post-build-tests-environments github workflows YAML", async () => {
  expect(await createYamlGithubWorkflows(config)).toMatchSnapshot();
});
