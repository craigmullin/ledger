const VPIC_DECODE_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended";

export interface DecodedVin {
  year: number;
  make: string;
  model: string;
  trim?: string;
}

interface VpicResult {
  ErrorCode?: string;
  ErrorText?: string;
  Make?: string;
  Model?: string;
  ModelYear?: string;
  Trim?: string;
  Series?: string;
}

interface VpicResponse {
  Results?: VpicResult[];
}

export function normalizeVin(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidVin(value: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(normalizeVin(value));
}

export async function decodeVin(vin: string, signal?: AbortSignal): Promise<DecodedVin> {
  const normalized = normalizeVin(vin);
  if (!isValidVin(normalized)) {
    throw new Error("Enter a complete 17-character VIN. VINs do not use I, O, or Q.");
  }

  const response = await fetch(`${VPIC_DECODE_URL}/${encodeURIComponent(normalized)}?format=json`, { signal });
  if (!response.ok) throw new Error("The VIN service is unavailable right now.");

  const payload = await response.json() as VpicResponse;
  const result = payload.Results?.[0];
  const year = Number(result?.ModelYear);
  if (!result?.Make || !result.Model || !Number.isInteger(year)) {
    const detail = result?.ErrorText?.split(";").find((message) => message.trim())?.trim();
    throw new Error(detail || "This VIN could not be decoded. You can still enter the vehicle manually.");
  }

  return {
    year,
    make: result.Make.trim(),
    model: result.Model.trim(),
    trim: (result.Trim || result.Series)?.trim() || undefined,
  };
}
