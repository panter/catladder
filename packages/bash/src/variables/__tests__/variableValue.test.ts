import { describe, it, expect } from "vitest";
import {
  VariableReference,
  createVariableValueContainingReferencesFromString,
} from "../VariableValueContainingReferences";

describe("createVarialeValueFromString", () => {
  it("should create a VariableValue from a simple string", () => {
    const stringValue = "hello world";

    const result = createVariableValueContainingReferencesFromString(
      stringValue,
      {
        componentName: "myComponent",
      },
    );

    expect(result.parts).toEqual([stringValue]);
  });

  it("extracts references to other components", () => {
    const stringValue =
      "the other component has ${otherComponent:variableName}, isn't that cool?";

    const result = createVariableValueContainingReferencesFromString(
      stringValue,
      {
        componentName: "myComponent",
      },
    );

    expect(result.parts).toEqual([
      "the other component has ",
      new VariableReference("otherComponent", "variableName"),
      ", isn't that cool?",
    ]);
  });

  it("extracts self references", () => {
    const stringValue = "my component has ${variableName}!";

    const result = createVariableValueContainingReferencesFromString(
      stringValue,
      {
        componentName: "myComponent",
      },
    );

    expect(result.parts).toEqual([
      "my component has ",
      new VariableReference("myComponent", "variableName"),
      "!",
    ]);
  });
  it("extracts multiple references", () => {
    const stringValue =
      "my component has ${variableName} and the other component has ${otherComponent:variableName}!";

    const result = createVariableValueContainingReferencesFromString(
      stringValue,
      {
        componentName: "myComponent",
      },
    );

    expect(result.parts).toEqual([
      "my component has ",
      new VariableReference("myComponent", "variableName"),
      " and the other component has ",
      new VariableReference("otherComponent", "variableName"),
      "!",
    ]);
  });
});
