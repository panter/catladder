import { it, expect } from "vitest";
import {
  createYamlGithubWorkflows,
  createYamlLocalPipeline,
} from "./__utils__/helpers";
import config from "./cloud-run-nextjs";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for cloud-run-nextjs local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});

it("matches snapshot for cloud-run-nextjs github workflows YAML", async () => {
  expect(await createYamlGithubWorkflows(config)).toMatchSnapshot();
});
