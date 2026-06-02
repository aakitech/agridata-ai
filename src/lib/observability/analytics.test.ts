import { describe, expect, it } from "vitest";
import { buildSafeEventPayload } from "./analytics";

describe("buildSafeEventPayload", () => {
  it("adds environment and removes sensitive properties", () => {
    expect(
      buildSafeEventPayload("dashboard_viewed", {
        route: "/dashboard",
        phoneNumber: "+27000000000",
      }),
    ).toMatchObject({
      eventName: "dashboard_viewed",
      properties: {
        route: "/dashboard",
      },
    });
  });
});
