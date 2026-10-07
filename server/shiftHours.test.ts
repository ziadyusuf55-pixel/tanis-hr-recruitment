import { describe, it, expect } from "vitest";
import { parseShiftHours, shiftHoursPerDay, normalizeShiftHours } from "../shared/shiftHours";

describe("shiftHours", () => {
  it("parses the canonical form", () => {
    expect(shiftHoursPerDay("9:00 AM - 5:00 PM")).toBe(8);
    expect(normalizeShiftHours("9:00 AM - 5:00 PM")).toBe("9:00 AM - 5:00 PM");
  });
  it("parses sloppy forms", () => {
    expect(shiftHoursPerDay("9AM–5PM")).toBe(8);
    expect(shiftHoursPerDay("9 am to 5 pm")).toBe(8);
    expect(shiftHoursPerDay("4pm - 1am")).toBe(9);
    expect(shiftHoursPerDay("16:00-01:00")).toBe(9);
    expect(normalizeShiftHours("4pm-1am")).toBe("4:00 PM - 1:00 AM");
  });
  it("rejects garbage", () => {
    expect(parseShiftHours("night shift")).toBeNull();
    expect(parseShiftHours("9:60 AM - 5 PM")).toBeNull();
    expect(parseShiftHours("")).toBeNull();
    expect(shiftHoursPerDay(null)).toBe(0);
  });
});
