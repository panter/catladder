import type { SecretScope } from "../../../types/config";
import {
  deliversRuntimeSecretsOutsideCi,
  secretNeedsCiDelivery,
} from "../envVars";

describe("secretNeedsCiDelivery", () => {
  const cases: Array<[SecretScope[] | undefined, boolean, boolean]> = [
    [undefined, true, true],
    [[], true, true],
    [["runtime"], true, false],
    [["runtime"], false, true],
    [["runtime", "local"], true, false],
    [["local"], true, false],
    [["build"], true, true],
    [["deploy"], true, true],
    [["jobs"], true, true],
    [["runtime", "build"], true, true],
    [["runtime", "local", "jobs"], true, true],
  ];
  it.each(cases)("scopes %j outside=%s -> %s", (scopes, outside, expected) => {
    expect(
      secretNeedsCiDelivery({ scopes }, { runtimeSecretsOutsideCi: outside }),
    ).toBe(expected);
  });

  it("no deploy delivers runtime secrets outside CI yet", () => {
    expect(deliversRuntimeSecretsOutsideCi(false)).toBe(false);
  });
});
