import type { Timestamp } from "firebase/firestore";

export interface Vehicle {
  id: string;
  ownerUserId: string;
  nickname?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  vin?: string;
  licensePlate?: string;
  color?: string;
  heroAttachmentId?: string;
  heroImageUrl?: string;
  status: "active" | "sold" | "totaled" | "archived";
  latestMileage?: number;
  latestMileageDate?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  schemaVersion: 1;
}

export interface ServiceEntry {
  id: string;
  ownerUserId: string;
  vehicleId: string;
  description: string;
  title?: string;
  serviceDate: Timestamp;
  mileage?: number;
  providerType?: "diy" | "shop" | "dealer" | "other";
  totalCostCents?: number;
  estimatedShopCostCents?: number;
  aiReviewStatus: "not_requested" | "pending" | "reviewed" | "dismissed" | "failed";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  schemaVersion: 1;
}

export interface MaintenanceItem {
  id: string;
  ownerUserId: string;
  vehicleId: string;
  name: string;
  category?: string;
  priority: "low" | "normal" | "high";
  enabled: boolean;
  intervalMiles?: number;
  intervalMonths?: number;
  lastDoneMileage?: number;
  lastDoneDate?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  schemaVersion: 1;
}

export type View =
  | { name: "garage" }
  | { name: "vehicle"; vehicleId: string }
  | { name: "addVehicle" }
  | { name: "editVehicle"; vehicleId: string }
  | { name: "importCsv"; vehicleId: string }
  | { name: "editEntry"; vehicleId: string; entryId: string }
  | { name: "addEntry"; vehicleId: string };
