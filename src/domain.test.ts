import { describe, expect, it } from "vitest";
import { isValidEntry, normalizeMoneyToCents, shouldAdvanceMileage } from "./domain";

describe("Ledger entry rules", () => {
  it("requires only a description and service date", () => {
    expect(isValidEntry("Replaced rear pads", "2026-08-05")).toBe(true);
    expect(isValidEntry("   ", "2026-08-05")).toBe(false);
  });

  it("stores money as integer cents", () => {
    expect(normalizeMoneyToCents("286.44")).toBe(28644);
    expect(normalizeMoneyToCents("")).toBeUndefined();
  });

  it("does not silently regress latest mileage", () => {
    expect(shouldAdvanceMileage(118420, 117000)).toBe(false);
    expect(shouldAdvanceMileage(118420, 119001)).toBe(true);
  });
});
