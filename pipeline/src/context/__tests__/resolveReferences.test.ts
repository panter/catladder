import type { BashExpression } from "../../bash/BashExpression";
import {
  resolveReferences,
  translateLegacyFromComponents,
} from "../resolveReferences";

const unpackBashExpressions = (obj: Record<string, string | BashExpression>) =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, value.toString()])
  );
describe("resolveReferences", () => {
  it("replaces occurences of ${componentName:VARIABLE_NAME}", async () => {
    const variables = {
      a: "hello world",
      b: "a replaced value looks like this: '${api:FOO}', nice!",
    };
    const otherVariables: Record<string, Record<string, string>> = {
      api: {
        FOO: "foo from api",
      },
      frontend: {
        FOO: "foo from frontend",
      },
    };
    const result = await resolveReferences(variables, async (componentName) => {
      return otherVariables[componentName];
    });

    expect(unpackBashExpressions(result)).toEqual({
      a: "hello world",
      b: "a replaced value looks like this: 'foo from api', nice!",
    });
  });

  it("replaces self references with structure ${VARIABLE_NAME}", async () => {
    const variables = {
      FOO: "hello world",
      BAR: "this: ${FOO}!",
    };
    const result = await resolveReferences(variables);

    expect(unpackBashExpressions(result)).toEqual({
      FOO: "hello world",
      BAR: "this: hello world!",
    });
  });

  it("replaces self references mixed with other vars", async () => {
    const variables = {
      FOO: "hello from ${api:FOO}",
      BAR: "this: ${FOO}!",
    };
    const otherVariables: Record<string, Record<string, string>> = {
      api: {
        FOO: "foo from api",
      },
    };
    const result = await resolveReferences(variables, async (componentName) => {
      return otherVariables[componentName];
    });

    expect(unpackBashExpressions(result)).toEqual({
      FOO: "hello from foo from api",
      BAR: "this: hello from foo from api!",
    });
  });

  it("keeps variables as is if not found (when null is returned)", async () => {
    const variables = {
      a: "hello world",
      b: "a not found value looks like this: '${api:FOO}'",
    };
    const otherVariables: Record<string, Record<string, string>> = {};
    const result = await resolveReferences(variables, async (componentName) => {
      return otherVariables[componentName];
    });

    expect(unpackBashExpressions(result)).toEqual({
      a: "hello world",
      b: "a not found value looks like this: '${api:FOO}'",
    });
  });

  it("replaces mulitple levels deep", async () => {
    const variables = {
      a: "value is ${frontend:FOO}!",
    };
    const otherVariables: Record<string, Record<string, string>> = {
      api: {
        FOO: "foo from api",
      },
      frontend: {
        FOO: "hi, ${api:FOO}",
      },
    };
    const result = await resolveReferences(variables, async (componentName) => {
      return otherVariables[componentName];
    });

    expect(unpackBashExpressions(result)).toEqual({
      a: "value is hi, foo from api!",
    });
  });

  it("prevents endless loops", async () => {
    const variables = {
      a: "value is ${frontend:FOO}!",
    };
    const otherVariables: Record<string, Record<string, string>> = {
      api: {
        FOO: "api ${frontend:FOO}",
      },
      frontend: {
        FOO: "frontend ${api:FOO}",
      },
    };
    const result = await resolveReferences(variables, async (componentName) => {
      return otherVariables[componentName];
    });

    expect(unpackBashExpressions(result)).toEqual({
      a: "value is frontend api ${frontend:FOO}!",
    });
  });
});

describe("translateLegacyFromComponents", () => {
  it("translatetes the old `fromComponents` approach to ${componentName:variableName}", () => {
    const fromComponents = {
      api: {
        API_FOO: "FOO",
        API_BAR: "BAR",
      },
      www: {
        WWW_X: "X",
        WWW_Y: "Y",
      },
    };

    const result = translateLegacyFromComponents(fromComponents);
    expect(result).toEqual({
      API_FOO: "${api:FOO}",
      API_BAR: "${api:BAR}",
      WWW_X: "${www:X}",
      WWW_Y: "${www:Y}",
    });
  });
});
