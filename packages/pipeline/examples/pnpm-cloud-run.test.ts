import { it, expect } from "vitest";
import {
  createYamlGithubWorkflows,
  createYamlLocalPipeline,
} from "./__utils__/helpers";
import config from "./pnpm-cloud-run";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for pnpm-cloud-run local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});

it("matches snapshot for pnpm-cloud-run github workflows YAML", async () => {
  expect(await createYamlGithubWorkflows(config)).toMatchSnapshot();
});
