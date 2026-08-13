import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    www: {
      dir: "www",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west6",
        service: {
          healthCheck: {
            livenessProbe: {
              type: "http1",
              failureThreshold: 42,
              initialDelaySeconds: 1,
              path: "/something",
              periodSeconds: 2,
              timeoutSeconds: 3,
            },
            startupProbe: {
              type: "http1",
              failureThreshold: 43,
              initialDelaySeconds: 4,
              path: "/something2",
              periodSeconds: 5,
              timeoutSeconds: 6,
            },
          },
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: Health Check",
};
