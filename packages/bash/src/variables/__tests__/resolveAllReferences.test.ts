import { describe, it, expect } from "vitest";
import { getBashVariable } from "../../BashExpression";
import {
  VariableReference,
  VariableValueContainingReferences,
  createVariableValueContainingReferencesFromString,
} from "../VariableValueContainingReferences";
import { resolveAllReferences } from "../resolveAllReferences";

describe("replaceAllReferences", () => {
  it("should replace all references recursivly", async () => {
    const values = {
      myVar: createVariableValueContainingReferencesFromString(
        "the 2nd component has ${component2:variable1} and self reference ${variable2}",
        {
          componentName: "component1",
        },
      ),
      myOtherVar: createVariableValueContainingReferencesFromString(
        "the third component has ${component3:variable1}, isn't that cool?",
        {
          componentName: "component1",
        },
      ),
      myThirdVar: createVariableValueContainingReferencesFromString(
        "value from component3: ${component3:variable3}",
        {
          componentName: "component1",
        },
      ),
    };

    const getEnvVars = async (componentName: string) => {
      return {
        variable1: createVariableValueContainingReferencesFromString(
          `i am variable1 from ${componentName}`,
          { componentName },
        ),
        variable2: createVariableValueContainingReferencesFromString(
          `foo from ${componentName}`,
          {
            componentName,
          },
        ),
        variable3: createVariableValueContainingReferencesFromString(
          `i am referencing \${component1:variable1}`,
          { componentName },
        ),
      };
    };

    const result = await resolveAllReferences(values, getEnvVars);
    expect(result).toEqual({
      myVar: new VariableValueContainingReferences([
        "the 2nd component has ",
        "i am variable1 from component2",
        " and self reference ",
        "foo from component1",
      ]),
      myOtherVar: new VariableValueContainingReferences([
        "the third component has ",
        "i am variable1 from component3",
        ", isn't that cool?",
      ]),
      myThirdVar: new VariableValueContainingReferences([
        "value from component3: ",
        "i am referencing ",
        "i am variable1 from component1",
      ]),
    });
  });

  it("passes through plain strings and bash expressions and resolves self references against the map fetched for the own component", async () => {
    const DB_PASSWORD_SECRET = getBashVariable("CL_dev_api_DB_PASSWORD");

    // a merged env var map as produced by getEnvironmentVariables: mostly
    // plain values, plus a framework-generated value containing self
    // references (like the embedded database connection string)
    const values = {
      DB_USER: "my-user",
      DB_PASSWORD: DB_PASSWORD_SECRET,
      DATABASE_URL: new VariableValueContainingReferences([
        "postgresql://",
        new VariableReference("worker", "DB_USER"),
        ":",
        new VariableReference("worker", "DB_PASSWORD"),
        "@localhost/db",
      ]),
      EMPTY: null,
    };

    const getEnvVars = async (componentName: string) => {
      expect(componentName).toBe("worker");
      return {
        DB_USER: "my-user",
        // the fetched map contains the override, like a vars.public override
        // referencing another component's password
        DB_PASSWORD: DB_PASSWORD_SECRET,
      };
    };

    const result = await resolveAllReferences(values, getEnvVars);
    expect(result.DB_USER).toBe("my-user");
    expect(result.DB_PASSWORD).toBe(DB_PASSWORD_SECRET);
    expect(result.EMPTY).toBe(null);
    expect(result.DATABASE_URL).toEqual(
      new VariableValueContainingReferences([
        "postgresql://",
        "my-user",
        ":",
        DB_PASSWORD_SECRET,
        "@localhost/db",
      ]),
    );
    expect(result.DATABASE_URL.toString()).toBe(
      "postgresql://my-user:$CL_dev_api_DB_PASSWORD@localhost/db",
    );
  });

  it("detects infinte loop", async () => {
    const values = {
      myVar: createVariableValueContainingReferencesFromString(
        "i am referencing ${component2:variable1}",
        {
          componentName: "component1",
        },
      ),
    };

    const getEnvVars = async (componentName: string) => {
      if (componentName === "component2") {
        return {
          variable1: createVariableValueContainingReferencesFromString(
            `i am referencing \${component3:variable1}`,
            { componentName },
          ),
        };
      } else if (componentName === "component3") {
        return {
          variable1: createVariableValueContainingReferencesFromString(
            `i am referencing \${component1:variable1}`,
            { componentName },
          ),
        };
      } else {
        return {
          variable1: createVariableValueContainingReferencesFromString(
            `i am referencing \${component2:variable1}`,
            { componentName },
          ),
        };
      }
    };

    // expect to throw an error
    await expect(resolveAllReferences(values, getEnvVars)).rejects.toThrow(
      "Infinite loop detected in these variables: myVar (last reference: ${component1:variable1})",
    );
  });
});
