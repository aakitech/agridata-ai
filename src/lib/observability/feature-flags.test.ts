import { describe, expect, it } from "vitest";
import { buildFeatureFlagEventProperties } from "./feature-flags";

describe("buildFeatureFlagEventProperties", () => {
  it("captures safe flag evaluation context", () => {
    expect(
      buildFeatureFlagEventProperties("new-dashboard-cards", false, {
        userId: "user_1",
        orgId: "org_1",
        phoneNumber: "+27000000000",
      }),
    ).toEqual({
      feature: "new-dashboard-cards",
      enabled: false,
      userId: "user_1",
      orgId: "org_1",
    });
  });
});
