import { describe, expect, it } from "vitest";
import { normalizeError, toSafeError } from "./errors";

describe("normalizeError", () => {
  it("normalizes Error objects without leaking custom sensitive fields", () => {
    const error = Object.assign(new Error("Webhook failed"), {
      phoneNumber: "+27000000000",
    });

    expect(normalizeError(error)).toEqual({
      name: "Error",
      message: "Webhook failed",
    });
  });
});

describe("toSafeError", () => {
  it("strips custom enumerable fields attached to the error", () => {
    const error = Object.assign(new Error("Webhook failed"), {
      phoneNumber: "+27000000000",
      rawMessage: "sprayed field near school",
    });

    const safe = toSafeError(error);

    expect(safe.name).toBe("Error");
    expect(safe.message).toBe("Webhook failed");
    expect(safe.stack).toBe(error.stack);
    expect((safe as unknown as Record<string, unknown>).phoneNumber).toBeUndefined();
    expect((safe as unknown as Record<string, unknown>).rawMessage).toBeUndefined();
  });
});
