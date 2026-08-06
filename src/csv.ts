import type { ImportedServiceEntryValues } from "./data";

function cells(line: string): string[] {
  const values: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += character;
  }
  values.push(value.trim()); return values;
}

function money(value: string | undefined): number | undefined {
  const cleaned = value?.replace(/[$,\s]/g, "");
  if (!cleaned) return undefined;
  const amount = Number(cleaned); return Number.isFinite(amount) ? Math.round(amount * 100) : undefined;
}

function date(value: string | undefined): string | undefined {
  const match = value?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function provider(value: string | undefined): ImportedServiceEntryValues["providerType"] {
  const normalized = value?.toLowerCase() ?? "";
  if (/craig|self|diy|me\b/.test(normalized)) return "diy";
  if (/dealer/.test(normalized)) return "dealer";
  return normalized ? "shop" : undefined;
}

export function parseMaintenanceCsv(contents: string): ImportedServiceEntryValues[] {
  const [header, ...lines] = contents.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (!header) return [];
  const indexes = new Map(cells(header).map((name, index) => [name.toLowerCase().replace(/[^a-z]/g, ""), index]));
  const get = (row: string[], name: string) => row[indexes.get(name) ?? -1];
  const rows: ImportedServiceEntryValues[] = [];
  lines.map(cells).forEach((row) => {
    const serviceDate = date(get(row, "date")); const description = get(row, "service");
    const mileage = Number(get(row, "odom")?.replace(/,/g, ""));
    if (!serviceDate || !description) return;
    const entry: ImportedServiceEntryValues = { description, serviceDate };
    if (Number.isFinite(mileage)) entry.mileage = mileage;
    const totalCostCents = money(get(row, "totalcost")); if (totalCostCents != null) entry.totalCostCents = totalCostCents;
    const estimatedShopCostCents = money(get(row, "estimateddealercost")); if (estimatedShopCostCents != null) entry.estimatedShopCostCents = estimatedShopCostCents;
    const providerType = provider(get(row, "shop")); if (providerType) entry.providerType = providerType;
    rows.push(entry);
  });
  return rows;
}
