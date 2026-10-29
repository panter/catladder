import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  GENERATED_IMAGES_FOLDER,
  IMAGE_TAG_MARKER_FILE,
  JobImagesPlan,
} from "../jobImagesPlan";
import { getShippedImageDir } from "../shippedImages";

const CHART_DEPENDENCY =
  "helm-charts/the-panter-chart/charts/mailhog-5.0.1.tgz";

describe("JobImagesPlan shipped images", () => {
  it("materializes binary files byte for byte", () => {
    const plan = new JobImagesPlan("gitlab");
    plan.resolveRef({ catladderImage: "kubernetes" });

    const file = plan
      .getGeneratedFiles()
      .find(
        ({ path }) =>
          path === `${GENERATED_IMAGES_FOLDER}/kubernetes/${CHART_DEPENDENCY}`,
      );

    expect(file?.content).toEqual(
      readFileSync(join(getShippedImageDir("kubernetes"), CHART_DEPENDENCY)),
    );
  });

  it("keeps text files as strings", () => {
    const plan = new JobImagesPlan("gitlab");
    plan.resolveRef({ catladderImage: "kubernetes" });

    const dockerfile = plan
      .getGeneratedFiles()
      .find(
        ({ path }) =>
          path === `${GENERATED_IMAGES_FOLDER}/kubernetes/Dockerfile`,
      );

    expect(typeof dockerfile?.content).toBe("string");
  });
});

describe("JobImagesPlan image tag marker", () => {
  it("materializes the image tag into a watched file", () => {
    const plan = new JobImagesPlan("gitlab");
    const { image } = plan.resolveRef({ catladderImage: "jobs-default" });
    const tag = image.split(":").pop();

    const marker = plan
      .getGeneratedFiles()
      .find(
        ({ path }) =>
          path ===
          `${GENERATED_IMAGES_FOLDER}/jobs-default/${IMAGE_TAG_MARKER_FILE}`,
      );

    // a tag change that leaves the definition byte-identical (e.g. a
    // salt bump) must still change a file the build job's
    // rules:changes watches, or the image is never built
    expect(marker?.content).toBe(`${tag}\n`);
    const [job] = plan.getEnsureJobs();
    expect(job.rules).toEqual([
      { changes: [`${GENERATED_IMAGES_FOLDER}/jobs-default/**/*`] },
    ]);
  });
});
