/**
 * The ONE payroll↔adjustment matching rule (Oct 2026 logic audit).
 * Pins the multi-id bridge: payroll row under "114070", bonus under "114063",
 * agent is "114063,114070" — every reader must see that bonus.
 */
import { describe, expect, it } from "vitest";
import { adjMatchesIdentity, crdtsCandidates, widenCrdtsAgainst } from "./db";

describe("crdtsCandidates", () => {
  it("full string + each id", () => {
    expect(crdtsCandidates("114063,114070")).toEqual(["114063,114070", "114063", "114070"]);
  });
  it("single id", () => {
    expect(crdtsCandidates("114063")).toEqual(["114063"]);
  });
});

describe("widenCrdtsAgainst — the sibling-id bridge", () => {
  const roster = ["114063,114070", "115000", "116001,116002"];
  it("a record under ONE id of a multi-id agent widens to ALL of that agent's ids", () => {
    const identity = widenCrdtsAgainst("114070", roster);
    expect(identity.has("114063")).toBe(true);
    expect(identity.has("114070")).toBe(true);
    expect(identity.has("114063,114070")).toBe(true);
    expect(identity.has("115000")).toBe(false);
  });
  it("an unknown id stays itself", () => {
    const identity = widenCrdtsAgainst("999999", roster);
    expect(Array.from(identity)).toEqual(["999999"]);
  });
});

describe("adjMatchesIdentity", () => {
  const roster = ["114063,114070"];
  const identity = widenCrdtsAgainst("114070", roster);
  it("bonus stored under the SIBLING id matches (the audited failure case)", () => {
    expect(adjMatchesIdentity("114063", identity)).toBe(true);
  });
  it("bonus stored under the full comma string matches", () => {
    expect(adjMatchesIdentity("114063,114070", identity)).toBe(true);
  });
  it("another agent's adjustment does not match", () => {
    expect(adjMatchesIdentity("115000", identity)).toBe(false);
  });
});
