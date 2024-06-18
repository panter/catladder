import { RULES_MANUAL_RELEASE, RULES_RELEASE } from "../../rules";
import { getRunnerImage } from "../../runner";

const EXPIRED_TOKEN_HELP =
  "echo '👉 The project access token might have expired - run `project-setup` in catladder CLI to fix.'";

export const getGitlabReleaseJobs = () => {
  return {
    ["create release"]: {
      stage: "release",
      image: getRunnerImage("semantic-release"),
      script: ["semanticRelease"],
      after_script: [EXPIRED_TOKEN_HELP],
      rules: RULES_RELEASE,
    },
    ["⚠️ force create release"]: {
      stage: "release",
      image: getRunnerImage("semantic-release"),
      script: ["semanticRelease"],
      after_script: [EXPIRED_TOKEN_HELP],
      needs: [],
      rules: RULES_MANUAL_RELEASE,
    },
  };
};
