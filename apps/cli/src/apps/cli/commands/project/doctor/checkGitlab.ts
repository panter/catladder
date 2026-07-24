import type { ComponentContext } from "@catladder/pipeline";
import { isOfDeployType } from "@catladder/pipeline";
import { differenceInCalendarDays } from "date-fns";
import type { IO } from "../../../../../core/types";
import {
  doGitlabRequest,
  doGitlabRequestAllPages,
  getProjectInfo,
} from "../../../../../utils/gitlab";
import type { DoctorReport } from "./DoctorReport";

const EXPIRY_WARNING_DAYS = 30;

/**
 * the gitlab-side outputs of `project setup`: the semantic-release
 * access token (+ its GL_TOKEN ci variable), the catladder topic and —
 * for kubernetes deploys — the registry deploy token.
 *
 * Kubernetes namespace/rbac checks are deliberately skipped: they would
 * require connecting kubectl to every cluster, which switches the local
 * kubeconfig context — doctor must not change anything.
 */
export const checkGitlab = async (
  instance: IO,
  report: DoctorReport,
  contexts: ComponentContext[],
) => {
  report.section("gitlab project setup");

  let projectId: string;
  try {
    projectId = (await getProjectInfo(instance)).id;
  } catch (e) {
    report.warn(
      `could not reach the gitlab api — gitlab checks skipped (${e.message})`,
    );
    return;
  }

  try {
    const tokens = await doGitlabRequestAllPages(
      instance,
      `projects/${projectId}/access_tokens`,
    );
    const activeTokens = tokens.filter(
      (t) => t.name === "semantic-release" && t.active === true,
    );
    // the GL_TOKEN ci variable holds exactly one of them — judge by the
    // one that lives longest
    const token = activeTokens.sort((a, b) =>
      String(b.expires_at).localeCompare(String(a.expires_at)),
    )[0];
    if (activeTokens.length > 1) {
      report.warn(
        `${activeTokens.length} active 'semantic-release' tokens exist — duplicates from earlier setups, consider revoking the old ones`,
      );
    }
    if (!token) {
      report.fail(
        "no active 'semantic-release' project access token",
        "run: catladder project setup",
      );
    } else {
      const daysLeft = differenceInCalendarDays(
        new Date(token.expires_at),
        new Date(),
      );
      if (daysLeft < 0) {
        report.fail(
          `'semantic-release' token expired on ${token.expires_at}`,
          "run: catladder project setup (rotates the token)",
        );
      } else if (daysLeft <= EXPIRY_WARNING_DAYS) {
        report.warn(
          `'semantic-release' token expires in ${daysLeft} days (${token.expires_at})`,
          "run: catladder project setup (rotates the token)",
        );
      } else {
        report.ok(
          `'semantic-release' token active (expires ${token.expires_at})`,
        );
      }
    }

    try {
      await doGitlabRequest(
        instance,
        `projects/${projectId}/variables/GL_TOKEN`,
      );
      report.ok("GL_TOKEN ci variable present");
    } catch {
      report.fail(
        "GL_TOKEN ci variable missing",
        "run: catladder project setup",
      );
    }

    const { topics } = await doGitlabRequest(instance, `projects/${projectId}`);
    if (topics?.includes("catladder")) {
      report.ok("'catladder' project topic set");
    } else {
      report.fail(
        "'catladder' project topic missing",
        "run: catladder project setup",
      );
    }

    if (
      contexts.some((context) =>
        isOfDeployType(context.deploy?.config, "kubernetes"),
      )
    ) {
      const deployTokens = await doGitlabRequestAllPages(
        instance,
        `projects/${projectId}/deploy_tokens`,
      );
      if (
        deployTokens.find(
          (t: { name: string }) => t.name === "gitlab-deploy-token",
        )
      ) {
        report.ok("'gitlab-deploy-token' registry deploy token present");
      } else {
        report.fail(
          "'gitlab-deploy-token' registry deploy token missing (kubernetes cannot pull images)",
          "run: catladder project setup",
        );
      }
    }
  } catch (e) {
    report.warn(`gitlab checks aborted (${e.message})`);
  }
};
