import { Config } from "./types/config";

const sampleConfig: Config = {
  customerName: "pan",
  appName: "fonsi",
  components: {
    web: {
      dir: "web",
      build: {
        type: "node",
      },
      deploy: {
        type: "kubernetes",
        values: {
          application: {
            resources: {
              limits: {
                cpu: "100m",
              },
            },
          },
        },
      },
      vars: {
        public: {
          GOOGLE_TAG_MANAGER_ID: "1234",
        },
        fromComponents: {
          api: {
            API_URL: "ROOT_URL",
          },
        },
      },
      env: {
        prod: {
          hostname: "fudilo.ch",
          vars: {},
          deploy: {
            type: "kubernetes",
            values: {
              application: {
                resources: {
                  limits: {
                    cpu: "1000m",
                  },
                },
              },
            },
          },
        },
        myCustomProd: {
          type: "prod",
          hostname: "fudilo2.ch",
        },
      },
    },
    api: {
      env: {
        prod: {
          hostname: "api.fudilo.ch",
        },
        myCustomProd: {
          type: "prod",
          hostname: "api.fudilo2.ch",
        },
      },
      build: {
        type: "node",
      },
      deploy: {
        type: "kubernetes",
      },
      dir: "api",
    },
  },
};

export default sampleConfig;
