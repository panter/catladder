import { describe, expect, it } from "vitest";
import {
  getLocalAccessKeyFileName,
  getLocalAccessKeyFileVarName,
} from "../keyFiles";

describe("local access key file naming", () => {
  it("derives a file name per env and component", () => {
    expect(getLocalAccessKeyFileName("review", "web-app")).toBe(
      "gcp-review-web_app.json",
    );
  });
  it("exposes the path under a var that is not GOOGLE_APPLICATION_CREDENTIALS", () => {
    expect(getLocalAccessKeyFileVarName("review")).toBe(
      "CATLADDER_LOCAL_ACCESS_GCP_REVIEW_KEY_FILE",
    );
  });
});
