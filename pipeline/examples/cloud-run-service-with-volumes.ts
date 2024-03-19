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

        service: {
          volumes: {
            myMount: {
              type: "cloud-storage",
              bucket: "my-bucket",
              mountPath: "/mnt/my-mount",
            },

            myOtherMount: {
              type: "cloud-storage",
              bucket: "some-other-bucket",
              mountPath: "/mnt/my-second-mount",
              readonly: true,
            },
          },
        },

        jobs: {
          migrate: {
            command: "migrate",
            when: "postDeploy",
            volumes: {
              myMount: {
                type: "cloud-storage",
                bucket: "my-bucket",
                mountPath: "/mnt/my-mount",
              },
            },
          },
        },
      },
    },
  },
};

it("matches snapshot", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
