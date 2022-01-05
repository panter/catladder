import { exec } from "child-process-promise";

export type Cluster = {
  fullName: string;
  passToken?: string;
  passCredentials?: {
    ca_cert: string;
    token: string;
  };
  api_url?: string;
  connect: () => Promise<any>;
};

const clusters: {
  [clustername: string]: Cluster;
} = {
  demo: {
    fullName: "gke_skynet-164509_europe-west1-d_demo",
    connect: async () =>
      exec(
        "gcloud container clusters get-credentials demo --zone europe-west1-d --project skynet-164509"
      ),
  },
  production: {
    fullName: "gke_skynet-164509_europe-west1-d_production",
    passCredentials: {
      token: "syknet/clusters/production/token",
      ca_cert: "syknet/clusters/production/ca_cert",
    },

    api_url: "https://35.189.234.235",
    connect: async () =>
      exec(
        "gcloud container clusters get-credentials production --zone europe-west1-d --project skynet-164509"
      ),
  },
  panterGitlab: {
    fullName: "gke_skynet-intern_europe-west6-a_swiss-cluster",
    connect: async () =>
      exec(
        "gcloud container clusters get-credentials --project skynet-intern swiss-cluster --region europe-west6-a"
      ),
  },
};
export default clusters;
