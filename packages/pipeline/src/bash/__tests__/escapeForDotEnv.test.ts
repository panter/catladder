import { describe, expect, it } from "vitest";
import { escapeForDotEnv } from "../bashEscape";
import { BashExpression } from "../BashExpression";
import { VariableValueContainingReferences } from "../../variables/VariableValueContainingReferences";

describe("escapeForDotEnv", () => {
  it("returns plain strings as is", () => {
    expect(escapeForDotEnv("hello")).toBe("hello");
  });

  it("keeps json strings intact", () => {
    const json = '[{"name":"base","url":"https://example.com/graphql"}]';
    expect(escapeForDotEnv(json)).toBe(json);
  });

  /**
   * regression: values assembled from parts (e.g. urls) used to be
   * bash-escaped even when every part is a literal — baking \" into the
   * env value and breaking consumers that JSON.parse it. Surfaced when
   * the deterministic cloud run urls made such values fully literal.
   */
  it("does not bash-escape quotes when all parts are literal", () => {
    const value = new VariableValueContainingReferences([
      '[{"name":"base","url":"https://',
      "wea-food2050-dev-graph-base-935909403923.europe-west6.run.app",
      '/graphql"}]',
    ]);
    const result = escapeForDotEnv(value);
    expect(result).not.toContain("\\");
    expect(JSON.parse(result)).toEqual([
      {
        name: "base",
        url: "https://wea-food2050-dev-graph-base-935909403923.europe-west6.run.app/graphql",
      },
    ]);
  });

  it("still bash-escapes when a part is a bash expression", () => {
    const value = new VariableValueContainingReferences([
      '{"url":"',
      new BashExpression("$HOST"),
      '"}',
    ]);
    // expression values run through the escapeForDotEnv bash helper, so
    // inner quotes must be escaped for the surrounding double quotes
    expect(escapeForDotEnv(value)).toContain("escapeForDotEnv");
    expect(escapeForDotEnv(value)).toContain('\\"');
  });
});
