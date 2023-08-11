import { join } from "path";
import type { BuildConfigArtifactsReports } from "../types";
import type { Artifacts } from "../../types";
import type { OptionalArtifacts } from "../custom/testJob";

export const createArtifactsConfig = (
  rootPath: string,
  artifactsReports?: BuildConfigArtifactsReports,
  artifacts?: Artifacts
): OptionalArtifacts =>
  artifactsReports || artifacts
    ? {
        artifacts: {
          paths: [],
          ...artifacts,
          reports: {
            ...artifacts?.reports,
            junit: [
              artifactsReports?.junit,
              Array.isArray(artifacts?.reports?.junit) &&
                artifacts?.reports?.junit,
              typeof artifacts?.reports?.junit === "string" && [
                artifacts?.reports?.junit,
              ],
            ]
              .filter(Array.isArray)
              .reduce(
                (acc, curr) => [...acc, ...curr.map((p) => join(rootPath, p))],
                []
              ),
          },
        },
      }
    : undefined;
