import { RULES_MANUAL_RELEASE, RULES_RELEASE } from "../../rules";
import { getRunnerImage } from "../../runner";

export const getGitlabReleaseJobs = () => {
  return {
    ["create release"]: {
      stage: "release",
      image: getRunnerImage("semantic-release"),
      script: ["semanticRelease"],
      rules: RULES_RELEASE,
    },
    ["⚠️ force create release"]: {
      stage: "release",
      image: getRunnerImage("semantic-release"),
      script: ["semanticRelease"],
      needs: [],
      rules: RULES_MANUAL_RELEASE,
    },
  };
};
