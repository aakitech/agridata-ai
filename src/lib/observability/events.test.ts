import { describe, expect, it } from "vitest";
import { sanitizeEventProperties } from "./events";

describe("sanitizeEventProperties", () => {
  it("removes sensitive report and message fields", () => {
    const sanitized = sanitizeEventProperties({
      userId: "user_1",
      orgId: "org_1",
      phoneNumber: "+27000000000",
      rawMessage: "sprayed field near school",
      reportContent: "private report notes",
      route: "/dashboard",
    });

    expect(sanitized).toEqual({
      userId: "user_1",
      orgId: "org_1",
      route: "/dashboard",
    });
  });

  it("removes sensitive keys case-insensitively and in nested objects", () => {
    const sanitized = sanitizeEventProperties({
      userId: "user_1",
      PhoneNumber: "+27000000000",
      metadata: {
        route: "/reports",
        reportContent: "private",
      },
    } as never);

    expect(sanitized).toEqual({
      userId: "user_1",
      metadata: {
        route: "/reports",
      },
    });
  });
});
