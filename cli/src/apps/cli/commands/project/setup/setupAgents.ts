import type { CommandInstance } from "vorpal";
import { doGitlabRequest, getProjectInfo } from "../../../../../utils/gitlab";
import { getProjectConfig } from "../../../../../config/getProjectConfig";
import { getGitRemoteHostAndPath } from "../../../../../git/gitProjectInformation";
import { getMainBranch } from "../../../../../git";
import type { AgentConfig } from "@catladder/pipeline";

type TriggerToken = {
  id: number;
  description: string;
  created_at: string;
  last_used: string | null;
  token: string;
  updated_at: string;
  owner: any;
};

type Webhook = {
  id: number;
  url: string;
  name: string;
  description: string;
  project_id: number;
  push_events: boolean;
  push_events_branch_filter: string;
  issues_events: boolean;
  confidential_issues_events: boolean;
  merge_requests_events: boolean;
  tag_push_events: boolean;
  note_events: boolean;
  confidential_note_events: boolean;
  job_events: boolean;
  pipeline_events: boolean;
  wiki_page_events: boolean;
  deployment_events: boolean;
  releases_events: boolean;
  milestone_events: boolean;
  feature_flag_events: boolean;
  enable_ssl_verification: boolean;
  repository_update_events: boolean;
  alert_status: string;
  disabled_until: string | null;
  url_variables: any[];
  created_at: string;
  resource_access_token_events: boolean;
  custom_webhook_template: string;
  custom_headers: Array<{ key: string; value?: string }>;
};

type WebhookData = {
  url: string;
  name: string;
  description: string;
  issues_events: boolean;
  confidential_issues_events: boolean;
  merge_requests_events: boolean;
  note_events: boolean;
  confidential_note_events: boolean;
  custom_webhook_template: string;
};

const listTriggerTokens = async (
  instance: CommandInstance,
  projectId: string,
): Promise<TriggerToken[]> => {
  return await doGitlabRequest(instance, `projects/${projectId}/triggers`);
};

const deleteTriggerToken = async (
  instance: CommandInstance,
  projectId: string,
  triggerId: number,
): Promise<void> => {
  await doGitlabRequest(
    instance,
    `projects/${projectId}/triggers/${triggerId}`,
    undefined,
    "DELETE",
  );
};

const createTriggerToken = async (
  instance: CommandInstance,
  projectId: string,
  description: string,
): Promise<TriggerToken> => {
  return await doGitlabRequest(
    instance,
    `projects/${projectId}/triggers`,
    { description },
    "POST",
  );
};

const listWebhooks = async (
  instance: CommandInstance,
  projectId: string,
): Promise<Webhook[]> => {
  return await doGitlabRequest(instance, `projects/${projectId}/hooks`);
};

const createWebhook = async (
  instance: CommandInstance,
  projectId: string,
  webhookData: WebhookData,
): Promise<Webhook> => {
  return await doGitlabRequest(
    instance,
    `projects/${projectId}/hooks`,
    webhookData,
    "POST",
  );
};

const updateWebhook = async (
  instance: CommandInstance,
  projectId: string,
  hookId: number,
  webhookData: WebhookData,
): Promise<Webhook> => {
  return await doGitlabRequest(
    instance,
    `projects/${projectId}/hooks/${hookId}`,
    webhookData,
    "PUT",
  );
};

const setupAgentWebhook = async (
  instance: CommandInstance,
  projectId: string,
  agentName: string,
  triggerToken: string,
): Promise<Webhook> => {
  const webhookName = `cl_agent_${agentName}_webhook`;
  const { gitRemoteHost } = await getGitRemoteHostAndPath();
  const mainBranch = await getMainBranch();
  const webhookUrl = `https://${gitRemoteHost}/api/v4/projects/${projectId}/ref/${mainBranch}/trigger/pipeline?token=${triggerToken}`;

  instance.log(`Setting up webhook for agent: ${agentName}`);

  // List existing webhooks
  const existingWebhooks = await listWebhooks(instance, projectId);

  // Find existing webhook by name
  const existingWebhook = existingWebhooks.find(
    (webhook) => webhook.name === webhookName,
  );

  // Custom webhook template from the user's specification
  const customWebhookTemplate = JSON.stringify({
    variables: {
      ASSIGNEE_USER_ID: "{{object_attributes.assignee_id}}",
      OBJECT_DESCRIPTION: "{{object_attributes.description}}",
    },
    payload: {
      object_kind: "{{object_kind}}",
      event_type: "{{event_type}}",
      user_id: "{{user.id}}",
      user_name: "{{user.name}}",
      user_username: "{{user.username}}",
      user_avatar_url: "{{user.avatar_url}}",
      user_email: "{{user.email}}",
      project_id: "{{project.id}}",
      project_name: "{{project.name}}",
      project_web_url: "{{project.web_url}}",
      project_namespace: "{{project.namespace}}",
      project_path_with_namespace: "{{project.path_with_namespace}}",
      object_attributes_id: "{{object_attributes.id}}",
      object_attributes_iid: "{{object_attributes.iid}}",
      object_attributes_title: "{{object_attributes.title}}",
      object_attributes_description: "{{object_attributes.description}}",
      object_attributes_state: "{{object_attributes.state}}",
      object_attributes_created_at: "{{object_attributes.created_at}}",
      object_attributes_updated_at: "{{object_attributes.updated_at}}",
      object_attributes_url: "{{object_attributes.url}}",
      object_attributes_action: "{{object_attributes.action}}",
      object_attributes_noteable_type: "{{object_attributes.noteable_type}}",
      merge_request_id: "{{merge_request.id}}",
      merge_request_iid: "{{merge_request.iid}}",
      merge_request_title: "{{merge_request.title}}",
      merge_request_source_branch: "{{merge_request.source_branch}}",
      merge_request_time_estimate: "{{merge_request.time_estimate}}",
      // FIXME: may cause issues with gitlab webhooks when there are double quotes in the description
      //merge_request_description: "{{merge_request.description}}",
      merge_request_merge_status: "{{merge_request.merge_status}}",
      merge_request_last_commit_title: "{{merge_request.last_commit.title}}",
      // FIXME: may cause issues with gitlab webhooks when there are double quotes in the message
      //merge_request_last_commit_message:
      //  "{{merge_request.last_commit.message}}",
      merge_request_last_commit_author_name:
        "{{merge_request.last_commit.author.name}}",
      merge_request_last_commit_author_email:
        "{{merge_request.last_commit.author.email}}",
    },
  });

  const webhookData: WebhookData = {
    url: webhookUrl,
    name: webhookName,
    description: `Agent webhook for ${agentName} - triggers pipeline with custom payload`,
    issues_events: true,
    confidential_issues_events: false,
    merge_requests_events: false,
    note_events: true,
    confidential_note_events: false,
    custom_webhook_template: customWebhookTemplate,
  };

  let webhook: Webhook;

  if (existingWebhook) {
    instance.log(
      `Updating existing webhook: ${webhookName} (ID: ${existingWebhook.id})`,
    );
    webhook = await updateWebhook(
      instance,
      projectId,
      existingWebhook.id,
      webhookData,
    );
    instance.log(`✅ Updated webhook: ${webhook.name}`);
  } else {
    instance.log(`Creating new webhook: ${webhookName}`);
    webhook = await createWebhook(instance, projectId, webhookData);
    instance.log(`✅ Created webhook: ${webhook.name}`);
  }

  instance.log(`   Webhook ID: ${webhook.id}`);
  instance.log(`   Webhook URL: ${webhook.url}`);

  return webhook;
};

const setupAgentTriggerToken = async (
  instance: CommandInstance,
  projectId: string,
  agentName: string,
): Promise<TriggerToken> => {
  const tokenName = `cl_agent_${agentName}`;

  instance.log(`Setting up trigger token for agent: ${agentName}`);

  // List existing trigger tokens
  const existingTokens = await listTriggerTokens(instance, projectId);

  // Find and delete existing cl_agent_<agentName> tokens
  const existingAgentTokens = existingTokens.filter((token) =>
    token.description.startsWith(`cl_agent_${agentName}`),
  );

  for (const token of existingAgentTokens) {
    instance.log(
      `Deleting existing trigger token: ${token.description} (ID: ${token.id})`,
    );
    await deleteTriggerToken(instance, projectId, token.id);
  }

  // Create new trigger token
  const description = `${tokenName} - Agent trigger token for ${agentName}`;
  const newToken = await createTriggerToken(instance, projectId, description);

  instance.log(`✅ Created new trigger token: ${newToken.description}`);
  instance.log(`   Token ID: ${newToken.id}`);
  instance.log(`   Token: ${newToken.token}`);

  return newToken;
};

const setupAgent = async (
  instance: CommandInstance,
  agentName: string,
  agentConfig: AgentConfig,
) => {
  const { id: projectId } = await getProjectInfo(instance);

  instance.log(`🤖 Setting up agent: ${agentName}`);

  // Setup trigger token for this agent
  const triggerToken = await setupAgentTriggerToken(
    instance,
    projectId,
    agentName,
  );

  // Setup webhook for this agent
  await setupAgentWebhook(instance, projectId, agentName, triggerToken.token);

  instance.log(`✅ Agent ${agentName} setup complete!`);
};

export const setupAgents = async (instance: CommandInstance) => {
  const config = await getProjectConfig();

  instance.log("");
  instance.log("🤖 Setting up agents...");

  const agents = config.agents ?? {};
  const agentEntries = Object.entries(agents);

  if (agentEntries.length === 0) {
    instance.log("No agents configured in project config");
    return;
  }

  for (const [agentName, agentConfig] of agentEntries) {
    if (agentConfig.type === "claude" && agentConfig) {
      await setupAgent(instance, agentName, agentConfig);
    }
  }

  instance.log("✅ All agents setup complete!");
  instance.log("");
  instance.log("🔧 Manual setup required:");
  instance.log(
    "Please configure these environment variables in GitLab CI/CD unless they are already set (by group or global):",
  );
  instance.log("   Go to Settings > CI/CD > Variables and add:");
  instance.log(
    "   - CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY (your Anthropic API key, mark as Protected & Masked)",
  );
  instance.log(
    "   - AGENT_GITLAB_PERSONAL_ACCESS_TOKEN (token from agent.claude user, mark as Protected & Masked)",
  );
};
