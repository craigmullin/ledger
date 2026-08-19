import { describe, expect, it } from "vitest";
import { isValidEntry, normalizeMoneyToCents, shouldAdvanceMileage } from "./domain";
import { filterServiceEntries, withoutUndefined } from "./data";
import { Timestamp } from "firebase/firestore";

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

  it("does not send optional undefined fields to Firestore", () => {
    expect(withoutUndefined({ make: "Honda", trim: undefined })).toEqual({ make: "Honda" });
  });

  it("searches service history fields case-insensitively", () => {
    const entry = { id: "1", ownerUserId: "u", vehicleId: "v", description: "Routine service", notes: "Changed transmission fluid", parts: ["Honda HCF-2"], serviceDate: Timestamp.now(), aiReviewStatus: "not_requested" as const, schemaVersion: 1 as const };
    expect(filterServiceEntries([entry], "TRANSMISSION")).toEqual([entry]);
    expect(filterServiceEntries([entry], "hcf")).toEqual([entry]);
    expect(filterServiceEntries([{ ...entry, description: "Oil and filter change" }], "oil change")).toHaveLength(1);
    expect(filterServiceEntries([entry], "brakes")).toEqual([]);
  });
});
