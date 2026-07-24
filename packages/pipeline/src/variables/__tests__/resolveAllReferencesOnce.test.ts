import { describe, it, expect } from "vitest";
import {
  VariableReference,
  VariableValueContainingReferences,
  createVariableValueContainingReferencesFromString,
} from "../VariableValueContainingReferences";
import { resolveAllReferencesOnce } from "../resolveAllReferencesOnce";

describe("resolveAllReferencesOnce", () => {
  it("should replace all references", async () => {
    const values = {
      myVar: createVariableValueContainingReferencesFromString(
        "the 2nd component has ${component2:variable1} and self reference ${variable2}",
        { componentName: "component1" },
      ),
      myOtherVar: createVariableValueContainingReferencesFromString(
        "the third component has ${component3:variable1}, isn't that cool?",
        { componentName: "component1" },
      ),
      myThirdVar: createVariableValueContainingReferencesFromString(
        "value from component3: ${component3:variable3}",
        { componentName: "component1" },
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

    const result = await resolveAllReferencesOnce(values, getEnvVars);
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
        new VariableReference("component1", "variable1"),
      ]),
    });
  });
});
