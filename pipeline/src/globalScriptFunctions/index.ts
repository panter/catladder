class GlobalScriptFunction {
  constructor(
    public name: string,
    public script: string,
  ) {}

  toBashFunction() {
    return `function ${this.name} () {
            ${this.script}
        }`;
  }
  invoke(...args: string[]) {
    return `${this.name} ${args.join(" ")}`;
  }
}

export const globalScriptFunctions = new Map<string, GlobalScriptFunction>();

export const registerGlobalScriptFunction = (name: string, script: string) => {
  if (globalScriptFunctions.has(name)) {
    throw new Error(`Global script function ${name} already exists`);
  }
  const scriptFunction = new GlobalScriptFunction(name, script);
  globalScriptFunctions.set(name, scriptFunction);
  return scriptFunction;
};
