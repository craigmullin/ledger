import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { shouldAdvanceMileage } from "./domain";
import type { ServiceEntry, Vehicle } from "./types";

export async function loadVehicles(ownerUserId: string): Promise<Vehicle[]> {
  const snapshot = await getDocs(query(
    collection(db, "vehicles"),
    where("ownerUserId", "==", ownerUserId),
    where("status", "==", "active"),
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Vehicle)
    .sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
}

export async function addVehicle(
  ownerUserId: string,
  values: Pick<Vehicle, "year" | "make" | "model" | "nickname" | "trim" | "vin" | "licensePlate">,
) {
  return addDoc(collection(db, "vehicles"), {
    ...withoutUndefined(values),
    ownerUserId,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    schemaVersion: 1,
  });
}

export async function archiveVehicle(vehicleId: string) {
  await updateDoc(doc(db, "vehicles", vehicleId), {
    status: "archived",
    updatedAt: serverTimestamp(),
  });
}

export async function loadEntries(ownerUserId: string, vehicleId: string): Promise<ServiceEntry[]> {
  const snapshot = await getDocs(query(
    collection(db, "serviceEntries"),
    where("ownerUserId", "==", ownerUserId),
    where("vehicleId", "==", vehicleId),
    orderBy("serviceDate", "desc"),
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ServiceEntry);
}

export interface NewEntryValues {
  description: string;
  serviceDate: string;
  mileage?: number;
  totalCostCents?: number;
  providerType?: ServiceEntry["providerType"];
}

export async function addServiceEntry(ownerUserId: string, vehicleId: string, values: NewEntryValues) {
  const entryRef = doc(collection(db, "serviceEntries"));
  const vehicleRef = doc(db, "vehicles", vehicleId);
  const readingRef = values.mileage == null ? null : doc(collection(db, "odometerReadings"));
  const serviceDate = Timestamp.fromDate(new Date(`${values.serviceDate}T12:00:00`));

  await runTransaction(db, async (transaction) => {
    const vehicleSnapshot = await transaction.get(vehicleRef);
    if (!vehicleSnapshot.exists() || vehicleSnapshot.data().ownerUserId !== ownerUserId) {
      throw new Error("Vehicle not found or unavailable.");
    }

    transaction.set(entryRef, {
      ...withoutUndefined(values),
      ownerUserId,
      vehicleId,
      serviceDate,
      aiReviewStatus: "not_requested",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: 1,
    });

    if (readingRef && values.mileage != null) {
      transaction.set(readingRef, {
        ownerUserId,
        vehicleId,
        readingDate: serviceDate,
        mileage: values.mileage,
        source: "service_entry",
        serviceEntryId: entryRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        schemaVersion: 1,
      });

      const currentMileage = vehicleSnapshot.data().latestMileage as number | undefined;
      if (shouldAdvanceMileage(currentMileage, values.mileage)) {
        transaction.update(vehicleRef, {
          latestMileage: values.mileage,
          latestMileageDate: serviceDate,
          updatedAt: serverTimestamp(),
        });
      }
    }
  });

  return entryRef.id;
}

export function withoutUndefined<T extends object>(values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
