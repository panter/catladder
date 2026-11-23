import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { DeployConfigCloudRun } from "../..";
import type { ComponentContext } from "../../../types/context";
import { getRemoveOldRevisionsAndImagesCommand } from "../cleanup";

const imageRoot =
  "europe-west6-docker.pkg.dev/test-project/catladder-deploy/pan-test";

const createContext = (
  env = "dev",
  overrides: Partial<DeployConfigCloudRun> = {},
): ComponentContext =>
  ({
    name: "www",
    env,
    fullConfig: { customerName: "pan", appName: "test" },
    environment: {
      envType: env,
      fullName: `pan-test-${env}-www`,
      slugPrefix: env,
      instance:
        env === "review"
          ? { type: "review", reviewSlug: "mr123" }
          : { type: "fixed" },
    },
    deploy: {
      config: {
        type: "google-cloudrun",
        projectId: "test-project",
        region: "europe-west6",
        ...overrides,
      },
    },
  }) as ComponentContext;

const imageCleanup = (context: ComponentContext) =>
  getRemoveOldRevisionsAndImagesCommand(context, "postDeploy").filter(
    (command) => command.startsWith("gcloud artifacts docker images list"),
  );

describe("Cloud Run image cleanup", () => {
  it.each(["dev", "stage", "review"])(
    "keeps five environment images and three cache images on %s",
    (env) => {
      const [images, cache] = imageCleanup(createContext(env));
      const imagePath = `${imageRoot}/${env}/www${env === "review" ? "/mr123" : ""}`;
      expect(images).toContain(`list ${imagePath} --sort-by=~CREATE_TIME`);
      expect(images).toContain("| tail -n +6 |");
      expect(cache).toContain(`list ${imageRoot}/caches/www`);
      expect(cache).toContain("| tail -n +4 |");
    },
  );

  it("keeps ten environment images by default on prod", () => {
    expect(imageCleanup(createContext("prod"))[0]).toContain("| tail -n +11 |");
  });

  it("honors an explicit image retention count", () => {
    expect(
      imageCleanup(createContext("dev", { imagesToKeep: 10 }))[0],
    ).toContain("| tail -n +11 |");
  });

  it("keeps at least the retained revisions plus the serving image", () => {
    const context = createContext("dev", {
      imagesToKeep: 1,
      revisionsToKeep: 5,
    });
    expect(imageCleanup(context)[0]).toContain("| tail -n +7 |");
  });

  it.each([
    ["B", "A"],
    ["A", "B"],
  ])(
    "preserves overlapping images in listing order %s, %s",
    (first, second) => {
      const command = imageCleanup(createContext())[0];
      // Execute the generated selection/deletion pipeline with a local gcloud
      // stub: list returns the fixture and delete records its target.
      const deleted = execFileSync(
        "bash",
        [
          "-c",
          `gcloud() {
          case "$4" in
            list) printf '%s\\n' "$IMAGE_LIST" ;;
            delete) printf '%s\\n' "$5" ;;
            *) return 1 ;;
          esac
        }
        ${command}`,
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            IMAGE_LIST: [
              first,
              second,
              "old1",
              "old2",
              "old3",
              "old4",
              "old5",
            ].join("\n"),
          },
        },
      )
        .trim()
        .split("\n");
      expect(deleted).toEqual([
        `${imageRoot}/dev/www@old4`,
        `${imageRoot}/dev/www@old5`,
      ]);
      expect(deleted).not.toContain(`${imageRoot}/dev/www@A`);
      expect(deleted).not.toContain(`${imageRoot}/dev/www@B`);
    },
  );

  it.each([0, -1, 1.5, NaN, Infinity])(
    "rejects invalid imagesToKeep %s during generation",
    (imagesToKeep) => {
      expect(() =>
        imageCleanup(createContext("dev", { imagesToKeep })),
      ).toThrow("google-cloudrun imagesToKeep must be an integer >= 1");
    },
  );

  it("deletes the whole review image path and legacy path on stop", () => {
    expect(
      getRemoveOldRevisionsAndImagesCommand(createContext("review"), "onStop"),
    ).toEqual([
      `gcloud artifacts docker images delete ${imageRoot}/review/www/mr123 --quiet --delete-tags`,
      expect.stringContaining(`list ${imageRoot}/caches/www`),
      "set +e",
      `gcloud artifacts docker images delete ${imageRoot}/review/www --quiet --delete-tags`,
      "set -e",
    ]);
  });
});
