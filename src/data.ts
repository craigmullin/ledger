import {
  addDoc,
  collection,
  doc,
  deleteField,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, storage } from "./firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
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
  values: Pick<Vehicle, "year" | "make" | "model" | "nickname" | "trim" | "vin" | "licensePlate" | "color">,
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
  estimatedShopCostCents?: number;
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

export type ImportedServiceEntryValues = NewEntryValues;

export async function importServiceEntries(ownerUserId: string, vehicleId: string, rows: ImportedServiceEntryValues[]) {
  if (!rows.length) throw new Error("No valid maintenance rows were found.");
  if (rows.length > 200) throw new Error("Import no more than 200 entries at a time.");
  const vehicleRef = doc(db, "vehicles", vehicleId);
  const sortedRows = [...rows].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));

  await runTransaction(db, async (transaction) => {
    const vehicleSnapshot = await transaction.get(vehicleRef);
    if (!vehicleSnapshot.exists() || vehicleSnapshot.data().ownerUserId !== ownerUserId) throw new Error("Vehicle not found or unavailable.");
    let latestMileage = vehicleSnapshot.data().latestMileage as number | undefined;
    let latestMileageDate: Timestamp | undefined;

    for (const row of sortedRows) {
      const entryRef = doc(collection(db, "serviceEntries"));
      const serviceDate = Timestamp.fromDate(new Date(`${row.serviceDate}T12:00:00`));
      transaction.set(entryRef, { ...withoutUndefined(row), ownerUserId, vehicleId, serviceDate, aiReviewStatus: "not_requested", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), schemaVersion: 1 });
      if (row.mileage != null) {
        const readingRef = doc(collection(db, "odometerReadings"));
        transaction.set(readingRef, { ownerUserId, vehicleId, readingDate: serviceDate, mileage: row.mileage, source: "import", serviceEntryId: entryRef.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), schemaVersion: 1 });
        if (shouldAdvanceMileage(latestMileage, row.mileage)) { latestMileage = row.mileage; latestMileageDate = serviceDate; }
      }
    }
    if (latestMileage != null && latestMileageDate) transaction.update(vehicleRef, { latestMileage, latestMileageDate, updatedAt: serverTimestamp() });
  });
}

export async function updateVehicle(
  vehicleId: string,
  values: Pick<Vehicle, "year" | "make" | "model" | "nickname" | "trim" | "vin" | "licensePlate" | "color">,
) {
  await updateDoc(doc(db, "vehicles", vehicleId), {
    year: values.year,
    make: values.make,
    model: values.model,
    nickname: values.nickname ?? deleteField(),
    trim: values.trim ?? deleteField(),
    vin: values.vin ?? deleteField(),
    licensePlate: values.licensePlate ?? deleteField(),
    color: values.color ?? deleteField(),
    updatedAt: serverTimestamp(),
  });
}

export async function uploadVehiclePhoto(ownerUserId: string, vehicleId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose an image smaller than 10 MB.");
  const attachmentRef = doc(collection(db, "attachments"));
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `users/${ownerUserId}/vehicles/${vehicleId}/attachments/${attachmentRef.id}/${safeName}`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file, { contentType: file.type });
  const heroImageUrl = await getDownloadURL(fileRef);
  await updateDoc(doc(db, "vehicles", vehicleId), { heroAttachmentId: attachmentRef.id, heroImageUrl, updatedAt: serverTimestamp() });
  await setDoc(attachmentRef, { ownerUserId, vehicleId, ownerType: "vehicle", ownerId: vehicleId, storagePath, fileName: file.name, contentType: file.type, sizeBytes: file.size, documentType: "photo", uploadStatus: "complete", extractionStatus: "not_requested", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), schemaVersion: 1 });
  return heroImageUrl;
}

export async function uploadEntryPhoto(ownerUserId: string, vehicleId: string, serviceEntryId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose an image smaller than 10 MB.");
  const attachmentRef = doc(collection(db, "attachments"));
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `users/${ownerUserId}/vehicles/${vehicleId}/attachments/${attachmentRef.id}/${safeName}`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file, { contentType: file.type });
  await setDoc(attachmentRef, { ownerUserId, vehicleId, ownerType: "service_entry", ownerId: serviceEntryId, storagePath, fileName: file.name, contentType: file.type, sizeBytes: file.size, documentType: "photo", uploadStatus: "complete", extractionStatus: "not_requested", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), schemaVersion: 1 });
}

export function withoutUndefined<T extends object>(values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
