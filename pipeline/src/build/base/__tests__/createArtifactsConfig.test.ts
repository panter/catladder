import { createArtifactsConfig } from "../createArtifactsConfig";

describe("createArtifactsConfig", () => {
  it("returns undefined if no artifacts or artifactsReports", () => {
    expect(createArtifactsConfig(".")).toBeUndefined();
  });

  it("returns artifacts if no artifactsReports", () => {
    expect(
      createArtifactsConfig(".", undefined, {
        paths: ["testpath"],
        reports: {
          coverage_report: { coverage_format: "cobertura", path: "some" },
          terraform: "something",
        },
      }),
    ).toMatchSnapshot();
  });

  it("returns junit parts of artifactsReports", () => {
    expect(
      createArtifactsConfig(".", { junit: ["report.xml"] }),
    ).toMatchSnapshot();
  });

  it("merges junit files if both given", () => {
    const result = createArtifactsConfig(
      ".",
      { junit: ["partial-report.xml"] },
      {
        paths: ["testpath"],
        reports: {
          junit: "full-report.xml",
          terraform: "something",
        },
      },
    );
    expect(result).toMatchSnapshot();
    expect(result?.artifacts?.reports?.junit).toHaveLength(2);
  });
});
