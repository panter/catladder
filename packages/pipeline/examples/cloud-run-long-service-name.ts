import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    // too long to fit cloud run's deterministic url in a review environment
    // (where the service name also carries the merge request slug), but
    // fine in dev and prod
    "recipe-processing-service": {
      dir: "recipe-processing-service",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west6",
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: Long component name",
  description: `
Cloud run only serves its deterministic url
\`https://<service>-<projectNumber>.<region>.run.app\` while that hostname's
first dns label — service name plus project number — stays within the 63
characters dns allows. Past that, cloud run falls back to a legacy url built
from a random identifier that cannot be computed in advance.

So instead of generating a hostname that could never resolve, catladder
shortens the component part of the service name just enough to fit. The env
and the review slug stay intact, and names that already fit are never
touched: here \`dev\` and \`prod\` deploy as
\`pan-test-app-<env>-recipe-processing-service\`, while review environments —
which additionally carry \`mr<iid>\`/\`pr<number>\` — deploy as
\`pan-test-app-review-mr42-recipe-processing-ser\`.

A shortened name that would collide with another component's fails
generation instead, as does a name whose fixed parts (customer name, app
name, env, project number) already leave no room.
`,
};
