import { it, expect } from "vitest";
import {
  createYamlGithubWorkflows,
  createYamlLocalPipeline,
} from "./__utils__/helpers";
import config from "./changesets-releases";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for changesets-releases local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});

it("matches snapshot for changesets-releases github workflows YAML", async () => {
  expect(await createYamlGithubWorkflows(config)).toMatchSnapshot();
});
