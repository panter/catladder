import type { Config } from "../src";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    app: {
      dir: "app",
      build: {
        type: "custom",
        docker: {
          type: "custom",
          buildContextLocation: "component", // default is root
        },
        jobImage: "maven:3-eclipse-temurin-11",
        buildCommand: ["mvn package", "cp -r target dist"],
        sbom: {
          jobImage: "maven:3-eclipse-temurin-11",
          command: [
            "mvn org.cyclonedx:cyclonedx-maven-plugin:2.7.4:makeBom",
            "mv target/bom.json __sbom.json",
          ],
        },
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
      },
    },
  },
};

export default config;

export const information = {
  title: "Custom: Sbom Java",
};
