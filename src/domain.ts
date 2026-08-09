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

export function maintenanceStatus(item: { intervalMiles?: number; intervalMonths?: number; lastDoneMileage?: number; lastDoneDate?: Date }, mileage?: number, today = new Date()): "green" | "yellow" | "orange" | "red" {
  const mileageRatio = item.intervalMiles && item.lastDoneMileage != null && mileage != null ? (mileage - item.lastDoneMileage) / item.intervalMiles : 0;
  const dueDate = item.intervalMonths && item.lastDoneDate ? new Date(item.lastDoneDate.getFullYear(), item.lastDoneDate.getMonth() + item.intervalMonths, item.lastDoneDate.getDate()) : undefined;
  const timeRatio = dueDate && item.lastDoneDate ? (today.getTime() - item.lastDoneDate.getTime()) / (dueDate.getTime() - item.lastDoneDate.getTime()) : 0;
  const ratio = Math.max(mileageRatio, timeRatio);
  return ratio >= 1.1 ? "red" : ratio >= 1 ? "orange" : ratio >= .85 ? "yellow" : "green";
}

export type MaintenanceDueStatus = "overdue" | "dueSoon" | "upcoming" | "unscheduled";

export function maintenanceDue(item: { intervalMiles?: number; intervalMonths?: number; lastDoneMileage?: number; lastDoneDate?: Date }, mileage?: number, today = new Date()) {
  const nextMileage = item.intervalMiles != null && item.lastDoneMileage != null ? item.lastDoneMileage + item.intervalMiles : undefined;
  const nextDate = item.intervalMonths != null && item.lastDoneDate ? new Date(item.lastDoneDate.getFullYear(), item.lastDoneDate.getMonth() + item.intervalMonths, item.lastDoneDate.getDate()) : undefined;
  const mileageDelta = nextMileage != null && mileage != null ? nextMileage - mileage : undefined;
  const dateDelta = nextDate ? Math.ceil((nextDate.getTime() - today.getTime()) / 86_400_000) : undefined;
  if (nextMileage == null && nextDate == null) return { status: "unscheduled" as const, nextMileage, nextDate, mileageDelta, dateDelta };
  if ((mileageDelta != null && mileageDelta < 0) || (dateDelta != null && dateDelta < 0)) return { status: "overdue" as const, nextMileage, nextDate, mileageDelta, dateDelta };
  if ((mileageDelta != null && item.intervalMiles != null && mileageDelta <= item.intervalMiles * .1) || (dateDelta != null && dateDelta <= 30)) return { status: "dueSoon" as const, nextMileage, nextDate, mileageDelta, dateDelta };
  return { status: "upcoming" as const, nextMileage, nextDate, mileageDelta, dateDelta };
}
