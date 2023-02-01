import type { CommandInstance } from "vorpal";
import { doGitlabRequest, getProjectInfo } from "../../../../../utils/gitlab";

const catladderTopic = "catladder"

export const setupTopic = async (instance: CommandInstance) => {
  const { id: projectId } = await getProjectInfo(
    instance
  );

  const { topics } = await doGitlabRequest(
    instance,
    `projects/${projectId}`
  );

  await doGitlabRequest(
    instance,
    `projects/${projectId}`,
    { topics: [catladderTopic, ...topics] },
    "PUT"
  );
};
