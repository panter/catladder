import type { Config } from "../src";

const config = {
  appName: "my-ai-app",
  customerName: "pan",
  components: {
    llm: {
      dir: "llm",
      build: false,
      vars: {
        secret: ["HF_TOKEN"],
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west4", // verify in which regions GPUs are available, europe-west6 is not supported as of time of writing
        service: {
          image:
            "us-docker.pkg.dev/deeplearning-platform-release/gcr.io/huggingface-text-generation-inference-cu124.2-3.ubuntu2204.py311",
          args: [
            "--model-id=meta-llama/Llama-3.2-1B-Instruct",
            "--max-concurrent-requests=1",
          ],
          cpu: 8,

          noCpuThrottling: true, // must be set to true for GPUs
          gpu: 1,
          gpuType: "nvidia-l4",
          memory: "32Gi",
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: llama example",
};
