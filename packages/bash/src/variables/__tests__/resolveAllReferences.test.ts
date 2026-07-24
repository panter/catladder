import { describe, it, expect } from "vitest";
import {
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
