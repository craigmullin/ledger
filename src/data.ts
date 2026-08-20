import {
  addDoc,
  collection,
  doc,
  deleteDoc,
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
import type { Attachment, MaintenanceItem, ServiceEntry, Vehicle, VehicleSpecification } from "./types";

export async function loadVehicles(ownerUserId: string): Promise<Vehicle[]> {
  const [snapshot, entrySnapshot] = await Promise.all([getDocs(query(
    collection(db, "vehicles"),
    where("ownerUserId", "==", ownerUserId),
    where("status", "==", "active"),
  )), getDocs(query(collection(db, "serviceEntries"), where("ownerUserId", "==", ownerUserId)))]);
  const summaries = new Map<string, { count: number; latest?: Timestamp }>();
  for (const entry of entrySnapshot.docs) {
    const data = entry.data() as ServiceEntry;
    const current = summaries.get(data.vehicleId) ?? { count: 0 };
    current.count += 1;
    if (!current.latest || data.serviceDate.toMillis() > current.latest.toMillis()) current.latest = data.serviceDate;
    summaries.set(data.vehicleId, current);
  }
  return snapshot.docs.map((item) => {
    const vehicle = ({ id: item.id, ...item.data() }) as Vehicle;
    const summary = summaries.get(vehicle.id);
    return { ...vehicle, serviceEventCount: summary?.count ?? 0, lastServiceEventAt: summary?.latest };
  })
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

export function filterServiceEntries(entries: ServiceEntry[], queryText: string): ServiceEntry[] {
  const search = queryText.trim().toLocaleLowerCase();
  if (!search) return entries;
  const tokens = search.split(/\s+/);
  return entries.filter((entry) => {
    const searchable = [entry.title, entry.description, entry.notes, entry.providerName, entry.providerType, entry.category, ...(entry.parts ?? [])]
      .filter(Boolean).join(" ").toLocaleLowerCase();
    return tokens.every((token) => searchable.includes(token));
  });
}

export async function updateServiceEntry(entryId: string, values: NewEntryValues) {
  await updateDoc(doc(db, "serviceEntries", entryId), { ...withoutUndefined(values), serviceDate: Timestamp.fromDate(new Date(`${values.serviceDate}T12:00:00`)), updatedAt: serverTimestamp() });
}

export async function recordMileage(ownerUserId: string, vehicleId: string, mileage: number, readingDate: string) {
  const vehicleRef = doc(db, "vehicles", vehicleId);
  const readingRef = doc(collection(db, "odometerReadings"));
  const date = Timestamp.fromDate(new Date(`${readingDate}T12:00:00`));
  await runTransaction(db, async (transaction) => {
    const vehicle = await transaction.get(vehicleRef);
    if (!vehicle.exists() || vehicle.data().ownerUserId !== ownerUserId) throw new Error("Vehicle not found or unavailable.");
    transaction.set(readingRef, { ownerUserId, vehicleId, readingDate: date, mileage, source: "manual", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), schemaVersion: 1 });
    if (shouldAdvanceMileage(vehicle.data().latestMileage as number | undefined, mileage)) transaction.update(vehicleRef, { latestMileage: mileage, latestMileageDate: date, updatedAt: serverTimestamp() });
  });
}

export async function loadMaintenanceItems(ownerUserId: string, vehicleId: string): Promise<MaintenanceItem[]> {
  const snapshot = await getDocs(query(collection(db, "maintenanceItems"), where("ownerUserId", "==", ownerUserId), where("vehicleId", "==", vehicleId)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MaintenanceItem);
}

export async function loadAllMaintenanceItems(ownerUserId: string): Promise<MaintenanceItem[]> {
  const snapshot = await getDocs(query(collection(db, "maintenanceItems"), where("ownerUserId", "==", ownerUserId)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MaintenanceItem);
}

export async function loadAttachments(ownerUserId: string, vehicleId?: string): Promise<Attachment[]> {
  const constraints = [where("ownerUserId", "==", ownerUserId)];
  if (vehicleId) constraints.push(where("vehicleId", "==", vehicleId));
  const snapshot = await getDocs(query(collection(db, "attachments"), ...constraints));
  const attachments = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Attachment);
  return Promise.all(attachments.map(async (attachment) => {
    try { return { ...attachment, downloadUrl: await getDownloadURL(ref(storage, attachment.storagePath)) }; }
    catch { return attachment; }
  })).then((items) => items.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)));
}

export async function addMaintenanceItem(ownerUserId: string, vehicleId: string, values: Omit<MaintenanceItem, "id" | "ownerUserId" | "vehicleId" | "createdAt" | "updatedAt" | "schemaVersion">) {
  return addDoc(collection(db, "maintenanceItems"), { ...withoutUndefined(values), ownerUserId, vehicleId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), schemaVersion: 1 });
}

export async function deleteMaintenanceItem(itemId: string) { await updateDoc(doc(db, "maintenanceItems", itemId), { enabled: false, updatedAt: serverTimestamp() }); }

export async function updateMaintenanceItem(itemId: string, values: Partial<Omit<MaintenanceItem, "id" | "ownerUserId" | "vehicleId" | "createdAt" | "updatedAt" | "schemaVersion">>) {
  await updateDoc(doc(db, "maintenanceItems", itemId), { ...withoutUndefined(values), updatedAt: serverTimestamp() });
}

export async function loadVehicleSpecifications(ownerUserId: string, vehicleId: string): Promise<VehicleSpecification[]> {
  const snapshot = await getDocs(query(collection(db, "vehicleSpecifications"), where("ownerUserId", "==", ownerUserId), where("vehicleId", "==", vehicleId)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as VehicleSpecification).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function addVehicleSpecification(ownerUserId: string, vehicleId: string, values: Omit<VehicleSpecification, "id" | "ownerUserId" | "vehicleId" | "createdAt" | "updatedAt" | "schemaVersion">) {
  return addDoc(collection(db, "vehicleSpecifications"), { ...withoutUndefined(values), ownerUserId, vehicleId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), schemaVersion: 1 });
}

export async function deleteVehicleSpecification(specificationId: string) { await deleteDoc(doc(db, "vehicleSpecifications", specificationId)); }

export async function updateVehicleSpecification(specificationId: string, values: Partial<Omit<VehicleSpecification, "id" | "ownerUserId" | "vehicleId" | "createdAt" | "updatedAt" | "schemaVersion">>) {
  await updateDoc(doc(db, "vehicleSpecifications", specificationId), { ...withoutUndefined(values), updatedAt: serverTimestamp() });
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
