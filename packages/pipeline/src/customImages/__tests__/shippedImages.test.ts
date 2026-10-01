import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { GENERATED_IMAGES_FOLDER, JobImagesPlan } from "../jobImagesPlan";
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
