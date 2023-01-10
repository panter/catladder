import type { Config } from "../src";
import { createAllPipelines } from "./__utils__/helpers";
const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    api: {
      dir: "api",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west6",
        cloudSql: {
          type: "unmanaged",
          instanceConnectionName: "projectId:region:instancename",
          dbUser: "my-user",
        },
        jobs: {
          migration: {
            when: "postDeploy",
            command: "yarn migrate",
          },
          ["send-reminders"]: {
            when: "schedule",
            command: "yarn job:send-reminders",
            schedule: "0 * * * *",
          },
        },
      },
    },
  },
};

it("matches snapshot", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
