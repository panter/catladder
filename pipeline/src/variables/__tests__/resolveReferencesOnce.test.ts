import {
  UnresolvableReference,
  VariableReference,
  createVariableValueContainingReferencesFromString,
} from "../VariableValueContainingReferences";
import { resolveReferencesOnce } from "../resolveReferencesOnce";

describe("resolveReferencesOnce", () => {
  it("should replace a reference to another component", async () => {
    const value = createVariableValueContainingReferencesFromString(
      "the other component has ${otherComponent:variableName}, isn't that cool?",
      {
        componentName: "myComponent",
      },
    );

    const result = resolveReferencesOnce(
      value,
      ({ componentName, variableName }) => {
        return createVariableValueContainingReferencesFromString(
          `replaced ${componentName}:${variableName}`,
          { componentName },
        );
      },
    );

    expect(result.parts).toEqual([
      "the other component has ",
      "replaced otherComponent:variableName",
      ", isn't that cool?",
    ]);
  });
  it("should keep references in replacement", async () => {
    const value = createVariableValueContainingReferencesFromString(
      "the other component has ${otherComponent:variableName}, isn't that cool?",
      {
        componentName: "myComponent",
      },
    );

    const result = resolveReferencesOnce(
      value,
      ({ componentName, variableName }) => {
        return createVariableValueContainingReferencesFromString(
          `replaced ${componentName}:${variableName}, contains reference to \${thirdComponent:x}`,
          { componentName },
        );
      },
    );

    expect(result.parts).toEqual([
      "the other component has ",

      "replaced otherComponent:variableName, contains reference to ",
      new VariableReference("thirdComponent", "x"),
      ", isn't that cool?",
    ]);
  });

  it("can be run multiple times", async () => {
    const value = createVariableValueContainingReferencesFromString(
      "the other component has ${otherComponent:variableName}, isn't that cool?",
      {
        componentName: "myComponent",
      },
    );
    const replacer = ({
      componentName,
      variableName,
    }: {
      componentName: string;
      variableName: string;
    }) => {
      return createVariableValueContainingReferencesFromString(
        componentName === "thirdComponent"
          ? "value from third component"
          : `replaced ${componentName}:${variableName}, contains reference to \${thirdComponent:x}`,
        { componentName },
      );
    };
    const result = resolveReferencesOnce(
      resolveReferencesOnce(value, replacer),
      replacer,
    );

    expect(result.parts).toEqual([
      "the other component has ",
      "replaced otherComponent:variableName, contains reference to ",
      "value from third component",
      ", isn't that cool?",
    ]);
  });

  it("flags unresolveable", async () => {
    const value = createVariableValueContainingReferencesFromString(
      "the other component has ${otherComponent:variableName}, isn't that cool?",
      {
        componentName: "myComponent",
      },
    );

    const result = resolveReferencesOnce(
      value,
      ({ componentName, variableName }) => {
        return null;
      },
    );

    expect(result.parts).toEqual([
      "the other component has ",
      new UnresolvableReference(
        new VariableReference("otherComponent", "variableName"),
      ),
      ", isn't that cool?",
    ]);
  });
});
