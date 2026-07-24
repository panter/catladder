import {
  getAllComponentsWithAllEnvsHierarchical,
  getEnvironment,
} from "../../../config/getProjectConfig";

/** which envs of which components a secrets command operates on */
export type SecretsScope = {
  [componentName: string]: string[];
};

/**
 * resolves a scope expression to component → envs:
 * - (empty): all components, all envs
 * - `env:component`: one env of one component
 * - `env` / `env:`: one env, every component that has it
 * - `:component`: every env of one component
 */
export const resolveSecretsScope = async (
  scope?: string,
): Promise<SecretsScope> => {
  const all = await getAllComponentsWithAllEnvsHierarchical();
  if (Object.keys(all).length === 0) {
    throw new Error("no catladder config found");
  }
  if (!scope) {
    return all;
  }

  const [env, componentName] = scope.split(":").map((x) => x || null);

  if (componentName && !(componentName in all)) {
    throw new Error(
      `unknown component "${componentName}" — components: ${Object.keys(all).join(", ")}`,
    );
  }

  const scoped = Object.fromEntries(
    Object.entries(all)
      .filter(([name]) => !componentName || name === componentName)
      .map(([name, envs]): [string, string[]] => [
        name,
        env ? envs.filter((e) => e === env) : envs,
      ])
      .filter(([, envs]) => envs.length > 0),
  );

  if (Object.keys(scoped).length === 0) {
    const allEnvs = [...new Set(Object.values(all).flat())];
    throw new Error(
      `no component has the environment "${env}" — environments: ${allEnvs.join(", ")}`,
    );
  }
  return scoped;
};

/**
 * all valid scope expressions, for autocompletion: `env:component`
 * pairs plus the `env:` (one env, all components) and `:component`
 * (one component, all envs) forms
 */
export const secretsScopeChoices = async (): Promise<string[]> => {
  const all = await getAllComponentsWithAllEnvsHierarchical();
  const pairs = Object.entries(all).flatMap(([componentName, envs]) =>
    envs.map((env) => `${env}:${componentName}`),
  );
  const envs = [...new Set(Object.values(all).flat())];
  return [
    ...pairs,
    ...envs.map((env) => `${env}:`),
    ...Object.keys(all).map((componentName) => `:${componentName}`),
  ];
};

/** one env of one component together with its (filtered) secret keys */
export type ScopedSecretKeys = Array<{
  env: string;
  componentName: string;
  keys: string[];
}>;

/** the secret keys declared in the config for one env of one component */
export const getDeclaredSecretKeys = async (
  env: string,
  componentName: string,
): Promise<string[]> => {
  const { secretEnvVarKeys, jobOnlyVars } = await getEnvironment(
    env,
    componentName,
  );
  return [
    ...jobOnlyVars.build.secretEnvVarKeys,
    ...jobOnlyVars.deploy.secretEnvVarKeys,
    ...secretEnvVarKeys,
  ]
    .filter((k) => !k.hidden)
    .map((k) => k.key);
};

/**
 * expands a scope to its declared secret keys, optionally filtered to
 * `onlyKeys`. Throws when a requested key is not declared anywhere in
 * the scope (typo protection); env/component pairs without matching
 * keys are dropped.
 */
export const getScopedSecretKeys = async (
  scope: SecretsScope,
  onlyKeys?: string[],
): Promise<ScopedSecretKeys> => {
  const scoped: ScopedSecretKeys = [];
  const declaredAnywhere = new Set<string>();
  for (const [componentName, envs] of Object.entries(scope)) {
    for (const env of envs) {
      const declared = await getDeclaredSecretKeys(env, componentName);
      declared.forEach((key) => declaredAnywhere.add(key));
      const keys = onlyKeys
        ? declared.filter((key) => onlyKeys.includes(key))
        : declared;
      if (keys.length > 0) {
        scoped.push({ env, componentName, keys });
      }
    }
  }

  const unknownKeys = (onlyKeys ?? []).filter(
    (key) => !declaredAnywhere.has(key),
  );
  if (unknownKeys.length > 0) {
    throw new Error(
      `these secrets are not declared in this scope: ${unknownKeys.join(", ")}` +
        `\ndeclared secrets: ${[...declaredAnywhere].join(", ")}`,
    );
  }
  if (scoped.length === 0) {
    throw new Error("there are no secrets to configure in this scope");
  }
  return scoped;
};

/** human-readable one-line-per-component summary of a scope */
export const formatScope = (scoped: ScopedSecretKeys): string => {
  const byComponent = new Map<string, string[]>();
  for (const { env, componentName } of scoped) {
    byComponent.set(componentName, [
      ...(byComponent.get(componentName) ?? []),
      env,
    ]);
  }
  return [...byComponent.entries()]
    .map(([componentName, envs]) => `- ${componentName}: ${envs.join(", ")}`)
    .join("\n");
};
