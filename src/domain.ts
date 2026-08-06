export function normalizeMoneyToCents(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid cost");
  return Math.round(amount * 100);
}

export function shouldAdvanceMileage(current: number | undefined, next: number): boolean {
  return current == null || next >= current;
}

export function isValidEntry(description: string, serviceDate: string): boolean {
  return description.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(serviceDate);
}
