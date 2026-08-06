import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeVin, isValidVin, normalizeVin } from "./vin";

afterEach(() => vi.unstubAllGlobals());

describe("VIN input", () => {
  it("normalizes pasted VINs", () => {
    expect(normalizeVin(" 1hgcm82633a004352 ")).toBe("1HGCM82633A004352");
  });

  it("requires 17 valid VIN characters", () => {
    expect(isValidVin("1HGCM82633A004352")).toBe(true);
    expect(isValidVin("1HGCM82633A00435")).toBe(false);
    expect(isValidVin("1HGCM82633O004352")).toBe(false);
  });

  it("maps NHTSA vehicle fields into editable form values", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ Results: [{ ModelYear: "2015", Make: "HONDA", Model: "CR-V", Trim: "EX-L" }] }),
    }));

    await expect(decodeVin("1HGCM82633A004352")).resolves.toEqual({
      year: 2015, make: "HONDA", model: "CR-V", trim: "EX-L",
    });
  });

  it("keeps manual entry available when NHTSA has no useful match", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ Results: [{ ErrorText: "VIN not found" }] }),
    }));

    await expect(decodeVin("1HGCM82633A004352")).rejects.toThrow("VIN not found");
  });
});
