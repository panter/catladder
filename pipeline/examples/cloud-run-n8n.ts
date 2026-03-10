import type { Config } from "../src";

const config = {
  appName: "my-n8n-app",
  customerName: "pan",
  components: {
    n8n: {
      dir: "n8n",
      build: false,
      vars: {
        secret: ["N8N_ENCRYPTION_KEY"],
        public: {
          N8N_PORT: "8080",
          N8N_PROTOCOL: "https",
          DB_TYPE: "postgresdb",
          DB_POSTGRESDB_DATABASE: "${DB_NAME}",
          DB_POSTGRESDB_HOST: "/cloudsql/${CLOUD_SQL_INSTANCE_CONNECTION_NAME}",
          DB_POSTGRESDB_USER: "${DB_USER}",
          DB_POSTGRESDB_PASSWORD: "${DB_PASSWORD}",
          DB_POSTGRESDB_PORT: "5432",
          DB_POSTGRESDB_SCHEMA: "public",
          GENERIC_TIMEZONE: "Europe/Zurich",
          N8N_DIAGNOSTICS_ENABLED: "false",
          N8N_PERSONALIZATION_ENABLED: "false",
          QUEUE_HEALTH_CHECK_ACTIVE: "true",
          WEBHOOK_URL: "${ROOT_URL}",
          N8N_EDITOR_BASE_URL: "${ROOT_URL}",
        },
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west6",
        cloudSql: {
          type: "unmanaged",
          instanceConnectionName: "projectId:region:instancename",
          dbBaseName: "n8n",
        },
        service: {
          image: "n8nio/n8n:2.12.0", // verify which is the current version
          command: ["/bin/sh"],
          args: ["-c", "sleep 5; n8n start"],
          minInstances: 1,
          maxInstances: 1,
          noCpuThrottling: true,
          memory: "2Gi",
          cpu: 2,
          executionEnvironment: "gen2",
          allowUnauthenticated: true,
          timeout: "3600s",
          sessionAffinity: true,
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: n8n example",
};
