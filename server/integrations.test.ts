import { describe, it, expect } from "vitest";

describe.skipIf(!process.env.HUBSPOT_API_TOKEN || !process.env.GOOGLE_CLIENT_ID)("HubSpot API token validation (needs real env secrets)", () => {
  it("should have HUBSPOT_API_TOKEN set in environment", () => {
    const token = process.env.HUBSPOT_API_TOKEN;
    expect(token).toBeTruthy();
    expect(token?.startsWith("pat-")).toBe(true);
  });

  it("should have GOOGLE_CLIENT_ID set in environment", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    expect(clientId).toBeTruthy();
    expect(clientId?.includes(".apps.googleusercontent.com")).toBe(true);
  });

  it("should have GOOGLE_CLIENT_SECRET set in environment", () => {
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    expect(secret).toBeTruthy();
    expect(secret?.startsWith("GOCSPX-")).toBe(true);
  });
});
