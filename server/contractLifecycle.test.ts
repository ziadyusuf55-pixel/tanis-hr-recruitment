import { appRouter } from "./routers";
import { workforceAgents } from "../drizzle/schema";
import { describe, expect, it } from "vitest";

describe("contract lifecycle workflow", () => {
  it("exposes the contract lifecycle fields in the workforce schema", () => {
    expect(workforceAgents.contractEndDate.name).toBe("contractEndDate");
    expect(workforceAgents.contractStartDate.name).toBe("contractStartDate");
    expect(workforceAgents.contractSigned.name).toBe("contractSigned");
  });

  it("registers the document contract signing procedure", () => {
    const procedures = appRouter._def.procedures as Record<string, unknown>;
    expect(procedures["documents.markContractSigned"]).toBeDefined();
  });
});
