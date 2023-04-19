export const parseChoice = (envComponent: string) => {
  const [env, componentName] = envComponent.split(":").map((x) => x || null);
  return { env: env as string, componentName };
};
