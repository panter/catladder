import { readFile, writeFile } from "fs-extra";
import { safeDump } from "js-yaml";
import { mapKeys, snakeCase, toUpper } from "lodash";
import path from "path";
import Vorpal from "vorpal";
import { hasGitlabCiFile } from "../../../../utils/projects";

const transformVar = (key: string) => toUpper(snakeCase(key));
type GitlabCiIncludeObj = {
  project: string;
  ref: string;
  file: string;
};

type FileToCreate = {
  filename: string;
  content: string | (() => Promise<string>);
};

type PlatformDefinition = {
  variables: {
    [key: string]: string;
  };
  gitlabCiInclude: GitlabCiIncludeObj;
  values: { [key: string]: unknown };
  filesToCreate?: FileToCreate[];
};
const DEFAULT_VARIABLES = {
  clusterName: "production",
};
// TODO: we should find a way how to fetch the variables of the inclues directly from gitlab
const DEFAULT_NODE_APPLICATION = {};

const DEFAULT_FILES_TO_CREATE: FileToCreate[] = [
  {
    filename: ".envrc",
    content: async () =>
      readFile(path.resolve(__dirname, "../includes/envrc"), "utf8"),
  },
];
const PLATFORMS: { [platformName: string]: PlatformDefinition } = {
  nextJS: {
    variables: {},
    gitlabCiInclude: {
      project: "catladder/gitlab-ci",
      ref: "v1",
      file: "node-kubernetes.yml",
    },
    values: {
      application: DEFAULT_NODE_APPLICATION,
    },
    filesToCreate: [
      {
        content: "v14",
        filename: ".nvmrc",
      },
    ],
  },
  nestJS: {
    variables: {},
    gitlabCiInclude: {
      project: "catladder/gitlab-ci",
      ref: "v1",
      file: "node-kubernetes.yml",
    },
    values: {
      application: {
        command: "yarn start:prod --port $(PORT)",
      },
    },
    filesToCreate: [
      {
        content: "v14",
        filename: ".nvmrc",
      },
    ],
  },
  node: {
    variables: {},
    gitlabCiInclude: {
      project: "catladder/gitlab-ci",
      ref: "v1",
      file: "node-kubernetes.yml",
    },
    values: {
      application: DEFAULT_NODE_APPLICATION,
    },
    filesToCreate: [
      {
        content: "v14",
        filename: ".nvmrc",
      },
    ],
  },
  staticJs: {
    variables: {},
    gitlabCiInclude: {
      project: "catladder/gitlab-ci",
      ref: "v1",
      file: "static-js-kubernetes.yml",
    },
    values: {},
  },
  meteor: {
    variables: {},
    gitlabCiInclude: {
      project: "gitlab-ci/meteor-kubernetes",
      ref: "v1",
      file: "meteor-kubernetes.yml",
    },
    values: {},
  },
  rails: {
    variables: {},
    gitlabCiInclude: {
      project: "catladder/gitlab-ci",
      ref: "v1",
      file: "rails-kubernetes.yml",
    },
    values: {
      env: {
        public: {
          RAILS_ENV: "production",
          PORT: 8080,
        },
        secret: {
          POSTGRESQL_PASSWORD: "app-secrets",
        },
      },
      application: {
        command: ["/cnb/process/web"],
        livenessProbe: {
          httpGet: {
            path: "/robots.txt",
            httpHeaders: null,
          },
        },
        readinessProbe: {
          httpGet: {
            path: "/robots.txt",
            httpHeaders: null,
          },
        },
      },
      cloudsql: { enabled: true },
      jobs: {
        "db-prepare": {
          hook: "post-install,post-upgrade",
          command: "/cnb/lifecycle/launcher bundle exec rake db:prepare",
        },
      },
    },
    filesToCreate: [
      {
        filename: "values-review.yml",
        content: async () =>
          safeDump({
            jobs: {
              "db-prepare-seed": {
                hook: "post-install",
                command:
                  "/cnb/lifecycle/launcher bundle exec rake db:prepare db:seed",
              },
              "db-prepare": {
                hook: "post-upgrade",
                command: "/cnb/lifecycle/launcher bundle exec rake db:prepare",
              },
            },
          }),
      },
    ],
  },
  other: {
    variables: {},
    gitlabCiInclude: {
      project: "catladder/gitlab-ci",
      ref: "v1",
      file: "panter-kubernetes-base.yml",
    },
    values: {},
  },
};
export default (vorpal: Vorpal) =>
  vorpal
    .command("project-init", "Inits a new project")
    .action(async function () {
      const hasGitlabFile = await hasGitlabCiFile();
      if (hasGitlabFile) {
        this.log("there is already a gitlab-ci.yml file. Skipping");
      } else {
        this.log("Alright. Let's do this! 😼");
        this.log("");

        const questions = [
          {
            type: "input",
            name: "customerName",
            default: "pan",
            message: "Which customer?",
          },
          {
            type: "input",
            name: "appName",
            message: "What is the app's name?",
          },
          {
            type: "input",
            name: "componentName",
            default: "web",
            message:
              "And the componentName?\n(in multi-app projects, you have to chose a different componentName for each app, e.g. frontend and backend)\n\n",
          },
          {
            type: "list",
            name: "platform",
            choices: Object.keys(PLATFORMS),
            message: "What is your app platform?",
          },
        ].map((q) => ({
          ...q,
          validate: Boolean,
          message: `${q.message} `,
        }));
        const { customerName, appName, componentName, platform } =
          await this.prompt(questions);

        const {
          gitlabCiInclude,
          variables: platformVariables,
          values,
          filesToCreate,
        } = PLATFORMS[platform];

        const allVariables = {
          customerName,
          appName,
          componentName,
          ...DEFAULT_VARIABLES,
          ...platformVariables,
        };
        const allFilesToCreate = [
          ...DEFAULT_FILES_TO_CREATE,
          ...(filesToCreate ?? []),
        ];
        const transformedVariables = mapKeys(allVariables, (value, key) =>
          transformVar(key)
        );

        const gitlabCiContentObj = {
          include: [gitlabCiInclude],
          variables: transformedVariables,
        };

        const gitlabCiContent = safeDump(gitlabCiContentObj);
        await writeFile(".gitlab-ci.yml", gitlabCiContent);

        allFilesToCreate.forEach(async ({ filename, content }) => {
          const theContent =
            typeof content === "function" ? await content() : content;
          await writeFile(filename, theContent);
        });

        await writeFile("values.yml", safeDump(values));

        this.log("");
        this.log("gitlab-ci created! 💪😻");
        this.log("feel free to adjust it to your needs!");
        this.log("");
        this.log("we also create an .envrc for you which works with direnv");
        this.log("");
      }
      const { shouldContinue } = await this.prompt({
        default: true,
        message:
          "should we continue with setting up your gitlab? 🤔 (connecting cluster and stuff)",
        name: "shouldContinue",
        type: "confirm",
      });
      if (shouldContinue) {
        await vorpal.execSync(`project-init-gitlab`);
      }
    });
