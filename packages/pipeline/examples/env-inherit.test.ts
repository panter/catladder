import { it, expect } from "vitest";
import {
  createYamlGithubWorkflows,
  createYamlLocalPipeline,
} from "./__utils__/helpers";
import config from "./env-inherit";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for env-inherit local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});

it("matches snapshot for env-inherit github workflows YAML", async () => {
  expect(await createYamlGithubWorkflows(config)).toMatchSnapshot();
});
